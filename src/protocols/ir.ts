export type CanonicalProtocol = "openai-chat" | "openai-responses" | "anthropic-messages";

export type CanonicalContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; url?: string; mediaType?: string }
  | { type: "audio"; url?: string; mediaType?: string }
  | { type: "video"; url?: string; mediaType?: string };

export type CanonicalMessage = {
  role: string;
  content: CanonicalContentBlock[];
};

export type CanonicalTool = {
  type: string;
  name?: string;
  raw: unknown;
};

export type CanonicalRequest = {
  protocol: CanonicalProtocol;
  model: string;
  messages: CanonicalMessage[];
  tools: CanonicalTool[];
  toolChoice?: unknown;
  responseFormat?: unknown;
  maxOutputTokens: number;
  stream: boolean;
  raw: unknown;
};

