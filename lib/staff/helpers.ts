export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && raw.startsWith("+")) return raw;
  if (raw.startsWith("+") && digits.length >= 10) return raw;
  return null;
}

export function randomPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 9; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}
