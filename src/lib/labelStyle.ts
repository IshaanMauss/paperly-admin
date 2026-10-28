// One rule for turning stored words into a display label. Identical port of the backend's app/services/label_style.py.
// The old titleCase() capitalised every word, so labels came out as "Area Of A Triangle", "Igcse" or "Hcf" while the
// taxonomy says "Area of a Triangle", "IGCSE", "HCF".

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "with"]);
const ACRONYMS: Record<string, string> = {
  igcse: "IGCSE", gcse: "GCSE", hcf: "HCF", lcm: "LCM", qp: "QP", ms: "MS", ai: "AI", qr: "QR",
  pdf: "PDF", png: "PNG", id: "ID", url: "URL", otp: "OTP", gst: "GST", usd: "USD", inr: "INR",
  api: "API", iqr: "IQR", sohcahtoa: "SOHCAHTOA", ui: "UI", ux: "UX", faq: "FAQ", pwa: "PWA",
};
const SEPARATOR_BEFORE = /(?:^\s*$|[:(]\s*$|\s[-–—+]\s+$|[.!?]\s+$)/;

export function labelCase(value: unknown): string {
  const text = String(value ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.replace(/[A-Za-z0-9][A-Za-z0-9'’]*/g, (word, offset: number) => {
    const low = word.toLowerCase();
    const startsPhrase = SEPARATOR_BEFORE.test(text.slice(0, offset));
    if (ACRONYMS[low]) return ACRONYMS[low];
    if (/^[0-9]+d$/.test(low)) return low.toUpperCase();
    if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
    if (SMALL_WORDS.has(low) && !startsPhrase) return low;
    return word[0].toUpperCase() + word.slice(1);
  });
}
