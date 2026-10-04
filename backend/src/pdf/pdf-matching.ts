/** Printed pagination can differ from a PDF by a few front-matter pages. */
export function pageTolerance(pages: number): number {
  return Math.max(5, Math.ceil(pages * 0.05));
}

export function pagesMatch(expected: number, actual: number): boolean {
  return (
    expected > 0 &&
    actual > 0 &&
    Math.abs(expected - actual) <= pageTolerance(expected)
  );
}

export function expectedPages(specs: unknown): number | null {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return null;
  const keys = new Set([
    'pages',
    'pagecount',
    'numberofpages',
    'noofpages',
    'numpages',
    'pagination',
  ]);
  for (const [key, value] of Object.entries(specs)) {
    if (!keys.has(key.toLowerCase().replace(/[^a-z]/g, ''))) continue;
    const raw = String(value).trim();
    // Accept numeric counts, thousands separators, and a trailing "pages" label.
    if (!/^[1-9]\d*(?:,\d{3})*(?:\s*(?:pages?|pp\.?))?$/i.test(raw)) continue;
    const pages = Number(raw.replace(/,/g, '').match(/^\d+/)?.[0]);
    if (Number.isSafeInteger(pages) && pages <= 20000) return pages;
  }
  return null;
}

export function pdfSearchQuery(title: string, author: string): string {
  const clean = (value: string) =>
    value
      .replace(/["\r\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return `"${clean(title)}" "${clean(author)}" filetype:pdf`;
}
