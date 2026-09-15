/**
 * providerMeta — geteilte Metadaten & Helfer für KI-Provider und Modelle.
 *
 * Ausgelagert aus ProvidersPage.jsx, damit Modellkatalog (ModelCatalog) und
 * Provider-Verwaltung dieselben Länder-/Regions-/Einstufungsdaten nutzen.
 */

// EU/EWR + Angemessenheitsländer (DSGVO Art. 45) — Basis der Schutzniveau-Einstufung
export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', // EEA
  'CH', 'GB', // Adequate countries
];

// Strikt EU/EWR (ohne Angemessenheitsländer) — für den Katalog-Filter
export const EU_EEA_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
];

// Schutzniveau-Einstufung (intern; Anzeige nur noch in den Modell-Details)
export function calculateSecurityTier(companyRegion, datacenterCountry) {
  const isGermanCompany = companyRegion === 'germany';
  const isEuCompany = companyRegion === 'eu' || isGermanCompany;
  const isGermanDC = datacenterCountry === 'DE';
  const isEuDC = datacenterCountry ? EU_COUNTRIES.includes(datacenterCountry) : false;

  if (isGermanCompany && isGermanDC) return 1;
  if (isEuCompany && isEuDC) return 2;
  if (!isEuCompany && isEuDC) return 3;
  return 4;
}

// Ruhige, sachliche Einordnung je Stufe — bewusst ohne Warn-Duktus: die
// Datenschutzprüfung läuft zentral über Adacor, die Stufe beschreibt nur die
// Verarbeitungssituation.
export const dataProtectionSummaries = {
  1: 'Verarbeitung in Deutschland durch einen deutschen Betreiber.',
  2: 'Verarbeitung in der EU/EWR durch einen europäischen Betreiber — kein Drittlandtransfer.',
  3: 'Internationaler Betreiber mit Datenverarbeitung in europäischen Rechenzentren (EU-Datenresidenz).',
  4: 'Datenverarbeitung kann außerhalb der EU erfolgen.',
};

// Company region options
export const companyRegions = [
  { value: 'germany', label: 'Deutschland', flag: '🇩🇪' },
  { value: 'eu', label: 'EU', flag: '🇪🇺' },
  { value: 'world', label: 'International', flag: '🌍' },
];

export const getRegionLabel = (region) => {
  return companyRegions.find((r) => r.value === region) || null;
};

// Country list with favorites first, then alphabetically sorted
export const favoriteCountries = [
  { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
  { code: 'NL', name: 'Niederlande', flag: '🇳🇱' },
  { code: 'FR', name: 'Frankreich', flag: '🇫🇷' },
  { code: 'CH', name: 'Schweiz', flag: '🇨🇭' },
  { code: 'FI', name: 'Finnland', flag: '🇫🇮' },
  { code: 'SE', name: 'Schweden', flag: '🇸🇪' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'GB', name: 'Großbritannien', flag: '🇬🇧' },
];

export const allCountries = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  { code: 'AL', name: 'Albanien', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algerien', flag: '🇩🇿' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'AR', name: 'Argentinien', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenien', flag: '🇦🇲' },
  { code: 'AU', name: 'Australien', flag: '🇦🇺' },
  { code: 'AT', name: 'Österreich', flag: '🇦🇹' },
  { code: 'AZ', name: 'Aserbaidschan', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesch', flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgien', flag: '🇧🇪' },
  { code: 'BA', name: 'Bosnien und Herzegowina', flag: '🇧🇦' },
  { code: 'BR', name: 'Brasilien', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgarien', flag: '🇧🇬' },
  { code: 'CA', name: 'Kanada', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Kolumbien', flag: '🇨🇴' },
  { code: 'HR', name: 'Kroatien', flag: '🇭🇷' },
  { code: 'CY', name: 'Zypern', flag: '🇨🇾' },
  { code: 'CZ', name: 'Tschechien', flag: '🇨🇿' },
  { code: 'DK', name: 'Dänemark', flag: '🇩🇰' },
  { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
  { code: 'EG', name: 'Ägypten', flag: '🇪🇬' },
  { code: 'EE', name: 'Estland', flag: '🇪🇪' },
  { code: 'FI', name: 'Finnland', flag: '🇫🇮' },
  { code: 'FR', name: 'Frankreich', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgien', flag: '🇬🇪' },
  { code: 'GR', name: 'Griechenland', flag: '🇬🇷' },
  { code: 'GB', name: 'Großbritannien', flag: '🇬🇧' },
  { code: 'HK', name: 'Hongkong', flag: '🇭🇰' },
  { code: 'HU', name: 'Ungarn', flag: '🇭🇺' },
  { code: 'IS', name: 'Island', flag: '🇮🇸' },
  { code: 'IN', name: 'Indien', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesien', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Irak', flag: '🇮🇶' },
  { code: 'IE', name: 'Irland', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italien', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordanien', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kasachstan', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenia', flag: '🇰🇪' },
  { code: 'KR', name: 'Südkorea', flag: '🇰🇷' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'LV', name: 'Lettland', flag: '🇱🇻' },
  { code: 'LB', name: 'Libanon', flag: '🇱🇧' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
  { code: 'LT', name: 'Litauen', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxemburg', flag: '🇱🇺' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹' },
  { code: 'MX', name: 'Mexiko', flag: '🇲🇽' },
  { code: 'MD', name: 'Moldawien', flag: '🇲🇩' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
  { code: 'MA', name: 'Marokko', flag: '🇲🇦' },
  { code: 'NL', name: 'Niederlande', flag: '🇳🇱' },
  { code: 'NZ', name: 'Neuseeland', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'MK', name: 'Nordmazedonien', flag: '🇲🇰' },
  { code: 'NO', name: 'Norwegen', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippinen', flag: '🇵🇭' },
  { code: 'PL', name: 'Polen', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'QA', name: 'Katar', flag: '🇶🇦' },
  { code: 'RO', name: 'Rumänien', flag: '🇷🇴' },
  { code: 'RU', name: 'Russland', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi-Arabien', flag: '🇸🇦' },
  { code: 'RS', name: 'Serbien', flag: '🇷🇸' },
  { code: 'SG', name: 'Singapur', flag: '🇸🇬' },
  { code: 'SK', name: 'Slowakei', flag: '🇸🇰' },
  { code: 'SI', name: 'Slowenien', flag: '🇸🇮' },
  { code: 'ZA', name: 'Südafrika', flag: '🇿🇦' },
  { code: 'ES', name: 'Spanien', flag: '🇪🇸' },
  { code: 'SE', name: 'Schweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Schweiz', flag: '🇨🇭' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TR', name: 'Türkei', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'Vereinigte Arabische Emirate', flag: '🇦🇪' },
  { code: 'US', name: 'USA', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'UZ', name: 'Usbekistan', flag: '🇺🇿' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
].sort((a, b) => a.name.localeCompare(b.name, 'de'));

export const getCountryByCode = (code) => {
  return allCountries.find((c) => c.code === code) || favoriteCountries.find((c) => c.code === code);
};

/**
 * Data Residency eines Modells: Modell-Override vor Provider-Land.
 * Liefert { code, name, flag } oder null.
 */
export function getModelResidency(model, provider) {
  const code = model?.datacenter_country || provider?.datacenter_country;
  if (!code) return null;
  const country = getCountryByCode(code);
  return country ? { code, name: country.name, flag: country.flag } : { code, name: code, flag: '' };
}

// Hersteller-Ableitung aus der Modell-ID (Namespace-Präfix) bzw. Heuristik.
// Zeigt die Modell-Herkunft als sekundäre Info — Vertragspartner ist Adacor.
const MANUFACTURERS = [
  { match: /^qwen\//i, label: 'Qwen (Alibaba)' },
  { match: /^Qwen\//, label: 'Qwen (Alibaba)' },
  { match: /^qwen/i, label: 'Qwen (Alibaba)' },
  { match: /^deepseek/i, label: 'DeepSeek' },
  { match: /^moonshotai\//i, label: 'Moonshot AI' },
  { match: /^z-ai\//i, label: 'Z.ai' },
  { match: /^minimax\//i, label: 'MiniMax' },
  { match: /^mistral/i, label: 'Mistral AI' },
  { match: /^meta-llama\//i, label: 'Meta' },
  { match: /^llama/i, label: 'Meta' },
  { match: /^openai\//i, label: 'OpenAI' },
  { match: /^gpt/i, label: 'OpenAI' },
  { match: /^whisper/i, label: 'OpenAI (Whisper)' },
  { match: /^tts-/i, label: 'OpenAI' },
  { match: /^claude/i, label: 'Anthropic' },
  { match: /^gemini/i, label: 'Google' },
  { match: /^fal-ai\//i, label: 'fal.ai' },
  { match: /e5-large/i, label: 'Microsoft (E5)' },
  { match: /^codellama/i, label: 'Meta' },
  { match: /^llava/i, label: 'LLaVA' },
];

export function getModelManufacturer(model) {
  const id = model?.id || '';
  for (const m of MANUFACTURERS) {
    if (m.match.test(id)) return m.label;
  }
  return null;
}

// Modell-Typ-Farbchips
export const typeColors = {
  llm: { bg: '#3b82f620', color: '#3b82f6' },
  vllm: { bg: '#8b5cf620', color: '#8b5cf6' },
  tts: { bg: '#10b98120', color: '#10b981' },
  stt: { bg: '#f59e0b20', color: '#f59e0b' },
  image_gen: { bg: '#ec489920', color: '#ec4899' },
  embedding: { bg: '#6b728020', color: '#6b7280' },
};

// Fähigkeits-Labels (Chips im Katalog und in Details)
export const capabilityLabels = {
  chat: 'Chat',
  function_calling: 'Functions',
  vision: 'Vision',
  speech: 'Speech',
  transcription: 'STT',
  text_to_image: 'Text→Bild',
  image_to_image: 'Bild→Bild',
  embedding: 'Embedding',
};

// Kontextfenster kompakt formatieren (256000 -> "256k")
export function formatContextLength(len) {
  if (!len || typeof len !== 'number') return null;
  if (len >= 1000) return `${Math.round(len / 1000)}k`;
  return String(len);
}
