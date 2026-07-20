import type { ModelSlotName, ProviderKind } from "./types.js";

export type ProviderChannel = {
  id: string;
  slot: ModelSlotName;
  provider: string;
  providerKind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  model: string;
  pricingModelId?: string;
  weight: number;
  supportsTools: boolean;
  supportsVision: boolean;
  isHealthy: boolean;
  cooldownUntil?: string | null;
  contextWindowTokens?: number;
};

export type ChannelSelectionStrategy = "round-robin" | "weighted-primary";

export type ChannelSelectionInput = {
  slot: ModelSlotName;
  requirements: {
    toolCalling: boolean;
    vision: boolean;
  };
  cursor: number;
  now?: Date;
  /** Channel ids already attempted in the current request — excluded so a
   *  fallback loop tries a *different* channel instead of retrying the same. */
  excludeIds?: string[];
  /** Selection strategy. Default: weighted-primary (highest weight first). */
  strategy?: ChannelSelectionStrategy;
  /** If provided and still eligible, force-select this provider instance. */
  pinnedProviderId?: string;
};

export type ChannelSelection = {
  channel: ProviderChannel;
  nextCursor: number;
};

function isCoolingDown(channel: ProviderChannel, now: Date): boolean {
  if (!channel.cooldownUntil) return false;
  const cooldown = new Date(channel.cooldownUntil);
  return Number.isFinite(cooldown.getTime()) && cooldown > now;
}

export function normalizedWeight(channel: ProviderChannel): number {
  return Number.isFinite(channel.weight) && channel.weight > 0 ? Math.floor(channel.weight) : 1;
}

export function selectProviderChannel(
  channels: ProviderChannel[],
  input: ChannelSelectionInput,
): ChannelSelection | undefined {
  const now = input.now ?? new Date();
  const eligible = channels.filter((channel) => {
    if (channel.slot !== input.slot) return false;
    if (!channel.isHealthy) return false;
    if (isCoolingDown(channel, now)) return false;
    if (input.requirements.toolCalling && !channel.supportsTools) return false;
    if (input.requirements.vision && !channel.supportsVision) return false;
    if (input.excludeIds?.includes(channel.id)) return false;
    return true;
  });

  if (eligible.length === 0) return undefined;

  // Session pinning takes precedence: if the pinned provider is healthy,
  // use it so a multi-turn conversation stays on the same upstream.
  if (input.pinnedProviderId) {
    const pinned = eligible.find((channel) => channel.id === input.pinnedProviderId);
    if (pinned) {
      return { channel: pinned, nextCursor: input.cursor };
    }
  }

  const strategy = input.strategy ?? "weighted-primary";

  if (strategy === "weighted-primary") {
    // Highest weight first; stable tie-breaker by id so the same primary
    // is consistently chosen across requests.
    const sorted = [...eligible].sort((a, b) => {
      const diff = normalizedWeight(b) - normalizedWeight(a);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
    return { channel: sorted[0]!, nextCursor: input.cursor };
  }

  // Legacy round-robin / weighted distribution.
  const weighted: ProviderChannel[] = [];
  for (const channel of eligible) {
    for (let i = 0; i < normalizedWeight(channel); i++) {
      weighted.push(channel);
    }
  }

  const index = Math.abs(input.cursor) % weighted.length;
  return {
    channel: weighted[index],
    nextCursor: (index + 1) % weighted.length,
  };
}
