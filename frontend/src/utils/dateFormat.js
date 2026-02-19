/**
 * Shared date formatting utilities.
 *
 * All formatters use the 'de-DE' locale and gracefully handle falsy input.
 */

/**
 * Format a date string as a short date: dd.MM.yyyy
 * Falls back to the raw input on parse errors.
 *
 * @param {string} dateStr
 * @param {string} [fallback='-'] - value returned when dateStr is falsy
 * @returns {string}
 */
export function formatDate(dateStr, fallback = '-') {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string as date + time: dd.MM.yyyy, HH:mm
 *
 * @param {string} dateString
 * @param {string} [fallback='-'] - value returned when dateString is falsy
 * @returns {string}
 */
export function formatDateTime(dateString, fallback = '-') {
  if (!dateString) return fallback;
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date string as a long date + time: d. Month yyyy, HH:mm
 *
 * @param {string} dateString
 * @param {string} [fallback='-'] - value returned when dateString is falsy
 * @returns {string}
 */
export function formatDateLong(dateString, fallback = '-') {
  if (!dateString) return fallback;
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date as a relative string (Heute / Gestern / vor X Tagen) or fall
 * back to a short locale date.  When {@link showTimeToday} is true the
 * current-day representation includes the time instead of the word "Heute".
 *
 * @param {string} dateString
 * @param {object}  [options]
 * @param {boolean} [options.showTimeToday=false] - show HH:mm instead of "Heute"
 * @param {string}  [options.fallback=''] - value returned when dateString is falsy
 * @returns {string}
 */
export function formatDateRelative(dateString, { showTimeToday = false, fallback = '' } = {}) {
  if (!dateString) return fallback;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    if (showTimeToday) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    return 'Heute';
  }
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}
