// Mirrors the backend release boundary; server-side filtering remains authoritative.
export function isExtractionReleased(file) {
  return file.status === 'completed'
    && (file.reviewStatus === 'reviewed' || (file.reviewStatus === 'auto_ok' && file.strategy === 'template-labelmap'))
    && !(file.validations || []).some(issue => issue.severity === 'error' || issue.status === 'not_evaluated');
}
