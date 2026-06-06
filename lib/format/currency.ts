const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Format paise (integer) to ₹12,34,567 */
export function formatINR(paise: number): string {
  return formatter.format(paise / 100);
}

/** Format paise to a plain number string: 12,34,567 */
export function formatINRPlain(paise: number): string {
  return new Intl.NumberFormat("en-IN").format(paise / 100);
}

/** Convert rupees (float/integer input) to paise */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert paise to rupees */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}
