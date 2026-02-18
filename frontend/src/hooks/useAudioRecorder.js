/**
 * useAudioRecorder Hook
 * Provides audio recording functionality using MediaRecorder API
 */

import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError(null);

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported MIME type - prefer formats that Whisper API supports
      // Priority: mp4/m4a > ogg > webm (webm often not recognized by Whisper)
      let mimeType = '';
      const preferredTypes = [
        'audio/mp4',           // Best compatibility with Whisper
        'audio/mpeg',          // MP3
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];

      for (const type of preferredTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      // Fallback
      if (!mimeType) {
        mimeType = 'audio/webm';
      }

      console.log('[AudioRecorder] Using MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setError('Aufnahme fehlgeschlagen');
        setIsRecording(false);
      };

      // Start recording with 1-second timeslice
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      if (err.name === 'NotAllowedError') {
        setError('Mikrofon-Zugriff verweigert. Bitte Berechtigung in den Browser-Einstellungen erteilen.');
      } else if (err.name === 'NotFoundError') {
        setError('Kein Mikrofon gefunden.');
      } else {
        setError('Aufnahme konnte nicht gestartet werden.');
      }
      throw err;
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        // Create blob from chunks
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // Determine file extension based on MIME type
        let extension = 'webm';
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
          extension = 'm4a';
        } else if (mimeType.includes('wav')) {
          extension = 'wav';
        }

        // Create File object
        const file = new File([blob], `recording-${Date.now()}.${extension}`, {
          type: mimeType,
        });

        // Stop all tracks on the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        chunksRef.current = [];
        resolve(file);
      };

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);
      mediaRecorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop media recorder if active
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    // Stop all tracks on the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset state
    setIsRecording(false);
    setRecordingTime(0);
    chunksRef.current = [];
    setError(null);
  }, []);

  // Format recording time as MM:SS
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    isRecording,
    recordingTime,
    formattedTime: formatTime(recordingTime),
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

export default useAudioRecorder;
