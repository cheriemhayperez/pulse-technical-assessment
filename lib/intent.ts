export const ASK_MAX = 24;

export const INTENT_IDS = [
  "help",
  "company",
  "trade",
  "food",
  "ride",
  "meet",
] as const;

export type IntentId = (typeof INTENT_IDS)[number];

export const INTENTS: {
  id: IntentId;
  emoji: string;
  label: string;
  short: string;
}[] = [
  { id: "help", emoji: "🙋", label: "Help", short: "Help" },
  { id: "company", emoji: "🎧", label: "Company", short: "Company" },
  { id: "trade", emoji: "🛒", label: "Trade", short: "Trade" },
  { id: "food", emoji: "🍜", label: "Food", short: "Food" },
  { id: "ride", emoji: "🚗", label: "Ride", short: "Ride" },
  { id: "meet", emoji: "💬", label: "Chat / Meet", short: "Chat" },
];

export function isIntentId(value: unknown): value is IntentId {
  return typeof value === "string" && (INTENT_IDS as readonly string[]).includes(value);
}

/** undefined = field omitted; null = clear/skip; "invalid" = reject */
export function readIntent(value: unknown): IntentId | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  return isIntentId(value) ? value : "invalid";
}

export function intentMeta(id: string | null | undefined) {
  if (!isIntentId(id)) return null;
  return INTENTS.find((item) => item.id === id) ?? null;
}

export function intentBadgeText(id: string | null | undefined): string | null {
  const meta = intentMeta(id);
  return meta ? `${meta.emoji} ${meta.short}` : null;
}

export function clipAsk(value: string): string {
  return Array.from(value.replace(/[\r\n\t]+/g, " ")).slice(0, ASK_MAX).join("");
}

/** undefined = field omitted; null = clear/skip; "invalid" = reject */
export function readAsk(value: unknown): string | null | "invalid" | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return "invalid";
  const cleaned = value
    .normalize("NFC")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return null;
  if (Array.from(cleaned).length > ASK_MAX) return "invalid";
  return cleaned;
}

export function publicAsk(value: unknown): string | null {
  const ask = readAsk(value ?? null);
  return typeof ask === "string" ? ask : null;
}
