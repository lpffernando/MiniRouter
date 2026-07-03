import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import Database from "better-sqlite3";
import { qualifiedAverageScore } from "./score-utils.mjs";
import { superclueLookupId } from "./superclue-model-aliases.mjs";

const DEFAULT_MONTH = "2026\u5e745\u6708";
const SUPERCLUE_PAGE_URL = "https://superclueai.com/generalpage";
const month = process.argv[2] ?? DEFAULT_MONTH;
const dataUrl = `https://superclueai.com/data/generalboard/${encodeURIComponent(month)}.xlsx`;
const now = new Date().toISOString();

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function unzipEntries(buffer) {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset--) {
    if (buffer.readUInt32LE(offset) === endSignature) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset === -1) throw new Error("Invalid xlsx: central directory not found");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let directoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(directoryOffset) !== 0x02014b50) {
      throw new Error("Invalid xlsx: bad central entry");
    }

    const compression = buffer.readUInt16LE(directoryOffset + 10);
    const compressedSize = buffer.readUInt32LE(directoryOffset + 20);
    const fileNameLength = buffer.readUInt16LE(directoryOffset + 28);
    const extraLength = buffer.readUInt16LE(directoryOffset + 30);
    const commentLength = buffer.readUInt16LE(directoryOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(directoryOffset + 42);
    const fileName = buffer
      .subarray(directoryOffset + 46, directoryOffset + 46 + fileNameLength)
      .toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid xlsx: bad local header for ${fileName}`);
    }
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = compression === 0 ? compressed : inflateRawSync(compressed);
    entries.set(fileName, content.toString("utf8"));

    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function sharedStrings(entries) {
  const xml = entries.get("xl/sharedStrings.xml");
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => text[1]).join("")),
  );
}

function columnIndex(ref) {
  const letters = ref.match(/[A-Z]+/)?.[0] ?? "";
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function parseSheet(entries, fileName, strings) {
  const xml = entries.get(fileName);
  if (!xml) throw new Error(`Missing worksheet: ${fileName}`);

  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)]
    .map((rowMatch) => {
      const row = [];
      for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellMatch[1];
        const ref = attrs.match(/\br="([^"]+)"/)?.[1];
        if (!ref) continue;
        const type = attrs.match(/\bt="([^"]+)"/)?.[1];
        const rawValue = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
        row[columnIndex(ref)] = type === "s" ? strings[Number(rawValue)] : rawValue;
      }
      return row;
    })
    .filter((row) => row.some((value) => value !== undefined && value !== ""));
}

function numeric(value) {
  if (value == null || value === "-") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundedScore(value) {
  const n = numeric(value);
  return n == null ? null : Math.round(n);
}

function recomputeOverall(row) {
  return qualifiedAverageScore([row.score_coding, row.score_reasoning, row.score_chinese], {
    minSignals: 2,
  });
}

function appendUnique(value, addition, separator = " ") {
  if (!value) return addition;
  if (value.includes(addition)) return value;
  return `${value.trim()}${separator}${addition}`;
}

function appendSource(value, source) {
  if (!value) return source;
  const sources = new Set(
    value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  sources.add(source);
  return [...sources].join("; ");
}

const response = await fetch(dataUrl);
if (!response.ok)
  throw new Error(`SuperCLUE download failed: ${response.status} ${response.statusText}`);
const xlsx = Buffer.from(await response.arrayBuffer());
const entries = unzipEntries(xlsx);
const rows = parseSheet(entries, "xl/worksheets/sheet1.xml", sharedStrings(entries));
const leaderboard = rows.slice(1);

mkdirSync(join(homedir(), ".minirouter"), { recursive: true });
const db = new Database(join(homedir(), ".minirouter", "minirouter.db"));

db.exec(`
CREATE TABLE IF NOT EXISTS superclue_models (
  month TEXT NOT NULL,
  model_name TEXT NOT NULL,
  organization TEXT,
  openness TEXT,
  total_score REAL,
  math_reasoning REAL,
  hallucination_control REAL,
  science_reasoning REAL,
  instruction_following REAL,
  code_generation REAL,
  agent_planning REAL,
  region TEXT,
  access_mode TEXT,
  is_reasoning TEXT,
  release_date TEXT,
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (month, model_name)
);
`);

for (const statement of [
  "ALTER TABLE model_scores ADD COLUMN source_pricing TEXT",
  "ALTER TABLE model_scores ADD COLUMN source_benchmark TEXT",
]) {
  try {
    db.prepare(statement).run();
  } catch (error) {
    if (!String(error.message).includes("duplicate column name")) throw error;
  }
}

const upsertRaw = db.prepare(`
  insert into superclue_models (
    month, model_name, organization, openness, total_score, math_reasoning,
    hallucination_control, science_reasoning, instruction_following,
    code_generation, agent_planning, region, access_mode, is_reasoning,
    release_date, source_url, created_at, updated_at
  ) values (
    @month, @model_name, @organization, @openness, @total_score, @math_reasoning,
    @hallucination_control, @science_reasoning, @instruction_following,
    @code_generation, @agent_planning, @region, @access_mode, @is_reasoning,
    @release_date, @source_url, @created_at, @updated_at
  )
  on conflict(month, model_name) do update set
    organization = excluded.organization,
    openness = excluded.openness,
    total_score = excluded.total_score,
    math_reasoning = excluded.math_reasoning,
    hallucination_control = excluded.hallucination_control,
    science_reasoning = excluded.science_reasoning,
    instruction_following = excluded.instruction_following,
    code_generation = excluded.code_generation,
    agent_planning = excluded.agent_planning,
    region = excluded.region,
    access_mode = excluded.access_mode,
    is_reasoning = excluded.is_reasoning,
    release_date = excluded.release_date,
    source_url = excluded.source_url,
    updated_at = excluded.updated_at
`);

const getScoreRow = db.prepare(
  "select score_coding, score_reasoning, score_chinese, source_benchmark, notes from model_scores where id = ? limit 1",
);
const updateModelScore = db.prepare(`
  update model_scores
  set
    score_chinese = @score_chinese,
    score_overall = @score_overall,
    source_benchmark = @source_benchmark,
    notes = @notes,
    updated_at = @updated_at
  where id = @id
`);

const matched = [];
const skipped = [];

const tx = db.transaction(() => {
  for (const row of leaderboard) {
    const raw = {
      month,
      model_name: row[1],
      organization: row[2],
      openness: row[3],
      total_score: numeric(row[4]),
      math_reasoning: numeric(row[5]),
      hallucination_control: numeric(row[6]),
      science_reasoning: numeric(row[7]),
      instruction_following: numeric(row[8]),
      code_generation: numeric(row[9]),
      agent_planning: numeric(row[10]),
      region: row[11],
      access_mode: row[12],
      is_reasoning: row[13],
      release_date: row[14],
      source_url: SUPERCLUE_PAGE_URL,
      created_at: now,
      updated_at: now,
    };
    upsertRaw.run(raw);

    const id = superclueLookupId(raw.model_name);
    if (!id) {
      skipped.push(raw.model_name);
      continue;
    }
    const scoreRow = getScoreRow.get(id);
    if (!scoreRow) {
      skipped.push(raw.model_name);
      continue;
    }

    const nextScoreRow = { ...scoreRow, score_chinese: roundedScore(raw.total_score) };
    const note = `SuperCLUE general score: ${raw.model_name} (${month}).`;
    updateModelScore.run({
      id,
      score_chinese: nextScoreRow.score_chinese,
      score_overall: recomputeOverall(nextScoreRow),
      source_benchmark: appendSource(scoreRow.source_benchmark, SUPERCLUE_PAGE_URL),
      notes: appendUnique(scoreRow.notes, note),
      updated_at: now,
    });
    matched.push({ id, model_name: raw.model_name, score_chinese: nextScoreRow.score_chinese });
  }
});

tx();

console.log(
  `Imported SuperCLUE ${month}: raw=${leaderboard.length}, matched=${matched.length}, skipped=${skipped.length}`,
);
console.table(matched);
if (skipped.length) console.log(`Skipped unmatched SuperCLUE models: ${skipped.join(", ")}`);
