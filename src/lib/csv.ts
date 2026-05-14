/**
 * Tiny RFC-4180-ish CSV parser. Handles:
 *  - quoted fields with embedded commas
 *  - escaped double-quotes ("")
 *  - CRLF / LF line endings
 *  - trailing empty lines
 */

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuote = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === ',') {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (c === '"' && cur === '') {
      inQuote = true;
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  out.push(cur);
  return out;
}

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): { header: string[]; rows: CsvRow[] } {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const obj: CsvRow = {};
    header.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim();
    });
    return obj;
  });
  return { header, rows };
}
