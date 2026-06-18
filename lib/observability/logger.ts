const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|signature|database|signedurl|endpoint|p256dh|auth)/i;
const PII_KEY = /(student|guardian|phone|email|fullName|body|notes?)/i;

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (PII_KEY.test(key)) return "[MINIMIZED]";
  if (depth > 4) return "[TRUNCATED]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, key, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitize(childValue, childKey, depth + 1),
      ]),
    );
  }
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}...[TRUNCATED]`;
  }
  return value;
}

type LogLevel = "info" | "warn" | "error";

export function logServer(
  level: LogLevel,
  event: string,
  context: Record<string, unknown> = {},
) {
  const sanitized = sanitize(context);
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
      ? sanitized
      : {}),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
