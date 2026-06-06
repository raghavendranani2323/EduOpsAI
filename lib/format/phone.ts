/** Format to +91 XXXXX XXXXX display */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

/** Normalise to E.164 +91XXXXXXXXXX */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return phone;
}

/** WhatsApp deep link for a given phone number and message */
export function whatsappLink(phone: string, message: string): string {
  const e164 = normalisePhone(phone).replace("+", "");
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}
