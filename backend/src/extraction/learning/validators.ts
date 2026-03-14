/**
 * Validators - Auto-correction helpers for flat field extraction
 *
 * Extracted from the original validator.ts for reuse.
 */

/**
 * Auto-correct German number format: "1.234,56" → 1234.56
 */
export function correctNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;

  let str = value.trim();
  if (!str) return null;

  // German format: 1.234,56 → remove dots, replace comma with dot
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Auto-correct date formats to YYYY-MM-DD
 */
export function correctDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const str = value.trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD.MM.YYYY (German format)
  const germanMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }

  // DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }

  // Try native Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]!;
  }

  return null;
}
