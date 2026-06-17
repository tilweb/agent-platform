/**
 * Transcription Service — wiederverwendbarer Whisper-Aufruf.
 *
 * Der Kern (Provider-Config laden, STT-URL bauen, FormData posten) lag bisher
 * nur in `routes/transcription.ts`. Hier extrahiert, damit sowohl die Route als
 * auch die Podcast-Repurposing-Pipeline denselben Code teilen.
 */

import { loadProvidersConfig, getProvider } from './providers';

/** True, wenn ein STT-Provider/-Modell konfiguriert + ein API-Key gesetzt ist. */
export async function isSttConfigured(): Promise<boolean> {
  try {
    const config = await loadProvidersConfig();
    const active = config.active.stt;
    if (!active?.provider_id || !active?.model_id) return false;
    const provider = await getProvider(active.provider_id);
    if (!provider || !provider.enabled) return false;
    const model = provider.models?.find((m) => m.id === active.model_id);
    if (!model) return false;
    const apiKey = provider.api_key_env ? process.env[provider.api_key_env] : null;
    return Boolean(apiKey);
  } catch {
    return false;
  }
}

/**
 * Transkribiert eine Audio-Datei (idealerweise MP3) über den aktiven STT-Provider.
 * Wirft mit klarer Meldung, wenn STT nicht konfiguriert ist oder die API fehlschlägt.
 */
export async function transcribeAudioFile(file: File, language = 'de'): Promise<string> {
  const config = await loadProvidersConfig();
  const active = config.active.stt;
  if (!active?.provider_id || !active?.model_id) {
    throw new Error('Spracherkennung (STT) ist nicht konfiguriert.');
  }

  const provider = await getProvider(active.provider_id);
  if (!provider || !provider.enabled) {
    throw new Error('Spracherkennung (STT) ist nicht verfügbar.');
  }

  const model = provider.models?.find((m) => m.id === active.model_id);
  if (!model) {
    throw new Error('STT-Modell ist nicht verfügbar.');
  }

  const apiKey = provider.api_key_env ? process.env[provider.api_key_env] : null;
  if (!apiKey) {
    throw new Error('STT-API-Key ist nicht konfiguriert.');
  }

  const baseUrl = model.base_url || provider.base_url;
  const transcriptionUrl = baseUrl.includes('/transcriptions')
    ? baseUrl
    : `${baseUrl}/transcriptions`;

  const whisperForm = new FormData();
  whisperForm.append('file', file);
  whisperForm.append('model', active.model_id);
  whisperForm.append('language', language);

  const response = await fetch(transcriptionUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[transcriptionService] Whisper API error:', response.status, errorText);
    throw new Error(`Whisper-API-Fehler (${response.status})`);
  }

  const result = (await response.json()) as { text?: string };
  return result.text ?? '';
}
