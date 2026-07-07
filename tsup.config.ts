import { builtinModules } from "node:module";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts", "src/server/serve.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node22",
  splitting: false,
  noExternal: [/^(?!better-sqlite3).*/],
  external: [...builtinModules.flatMap((m) => [m, `node:${m}`]), "better-sqlite3"],
});
