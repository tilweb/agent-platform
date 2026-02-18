/**
 * useTranscription Hook
 * Provides transcription functionality via the backend API
 */

import { useState, useCallback, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function useTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [isAvailable, setIsAvailable] = useState(null);
  const [sttInfo, setSttInfo] = useState(null);

  // Check STT availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch(`${API_URL}/transcribe/status`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setIsAvailable(data.available);
          if (data.available) {
            setSttInfo({ provider: data.provider, model: data.model });
          }
        } else {
          setIsAvailable(false);
        }
      } catch (err) {
        console.error('Failed to check STT availability:', err);
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, []);

  /**
   * Transcribe an audio file
   * @param {File} file - The audio file to transcribe
   * @param {string} language - Language code (default: 'de')
   * @returns {Promise<string>} - The transcribed text
   */
  const transcribe = useCallback(async (file, language = 'de') => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);

      const response = await fetch(`${API_URL}/transcribe`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Transkription fehlgeschlagen (${response.status})`;
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.text) {
        throw new Error('Keine Transkription erhalten');
      }

      return result.text;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transkription fehlgeschlagen';
      setError(errorMessage);
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    transcribe,
    isTranscribing,
    error,
    clearError,
    isAvailable,
    sttInfo,
  };
}

export default useTranscription;
