/**
 * Markdown → Klartext für die Übernahme ins Anschreiben, in Textbausteine und Notizen
 * (dort wird nicht gerendert; Bürgerbriefe dürfen keine **- oder #-Zeichen enthalten).
 * Aufzählungen werden zu „- ", nummerierte Listen bleiben nummeriert.
 */
export function markdownZuText(md) {
  return (md || '')
    .replace(/```[a-z]*\n?([\s\S]*?)```/g, '$1')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '- ')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[ \t]*\|?[ \t]*:?-{3,}[^\n]*\n?/gm, '')
    .replace(/^\|(.*)\|[ \t]*$/gm, (_, z) => z.split('|').map((x) => x.trim()).join(' · '))
    .replace(/^-{3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
