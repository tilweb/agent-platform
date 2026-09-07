/** Strict, locale-aware normalization. Never accept a numeric prefix or roll dates. */
export function correctNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  let normalized = text;
  if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d+(?:[.,]\d+)?$/.test(text)) {
    normalized = text.replace(',', '.');
  } else return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export function correctDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!iso && !local) return null;
  const [year, month, day] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : [Number(local![3]), Number(local![2]), Number(local![1])];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]!) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
