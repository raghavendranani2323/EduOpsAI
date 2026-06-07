export function isParentOtpEnabled(): boolean {
  return process.env.PARENT_OTP_ENABLED === "true" || process.env.NEXT_PUBLIC_PARENT_OTP_ENABLED === "true";
}

export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("91") && raw.startsWith("+")) return raw;
  if (raw.startsWith("+") && digits.length >= 10) return raw;
  return null;
}

export function phoneVariants(phone: string): string[] {
  // Match guardians stored as "+91XXXXXXXXXX" or "XXXXXXXXXX" or "91XXXXXXXXXX"
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return [phone];
  return [`+91${last10}`, `91${last10}`, last10, phone];
}
