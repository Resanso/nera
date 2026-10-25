/**
 * Strip personal data before any email text is sent to the AI model.
 * Amounts, dates, merchant names and order numbers are kept; they are what we extract.
 */
export function redact(text: string): string {
  return (
    text
      // email addresses
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      // Indonesian phone numbers: +62 / 62 / 08... (before cards, +62 numbers are 13 digits too)
      .replace(/(?:\+?62|\b0)8\d[\d\s-]{6,12}\d/g, "[telepon]")
      // card numbers (13-19 digits, optional spaces/dashes)
      .replace(/\b(?:\d[ -]?){13,19}\b/g, "[kartu]")
      // street addresses
      .replace(/\b(?:jl|jln|jalan)\.?\s[^\n,]{3,60}/gi, "[alamat]")
      // greetings with names: "Halo Budi," / "Hi Budi Santoso,"
      .replace(/\b([Hh]alo|[Hh]ai|[Hh]i|[Dd]ear|[Yy]th\.?)\s+[A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,2}/g, "$1 [nama]")
  );
}
