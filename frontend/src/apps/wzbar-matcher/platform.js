/**
 * Plattform-Anschluss des WZ-Branchen-Matchers (Frontend).
 *
 * Die EINZIGE Datei der App-Oberflaeche, die Code ausserhalb von
 * `apps/wzbar-matcher/` importiert. Wer die App in eine andere Plattform
 * einpasst, ersetzt diese Re-Exporte — die Komponenten bleiben unveraendert.
 *
 * Erwarteter Vertrag:
 * - apiGet(endpoint) / apiPost(endpoint, body): fetch gegen `<API-Basis><endpoint>`
 *   mit Session-Cookie, JSON-Body; liefern die rohe `Response` (auch fuer den
 *   SSE-Stream von /match/stream, der per `res.body.getReader()` gelesen wird).
 * - theme: Design-Tokens (colors, spacing, typography, borderRadius, shadows,
 *   transitions) — die genutzten Schluessel stehen im Uebergabedokument.
 * - Icons: SVG-Komponenten mit Props { size, color, style }.
 *
 * Ausserhalb dieser Datei kennt die Plattform die App nur ueber die Route
 * `/apps/wzbar-matcher` in App.jsx (lazy MatcherPage, geschuetzt per
 * RequireAppPermission appId="wzbar-matcher").
 */

export { apiGet, apiPost } from '../../utils/apiFetch';
export { theme } from '../../config/theme';
export { ClassifierIcon, CopyIcon, ListIcon, XIcon } from '../../components/Icons';
