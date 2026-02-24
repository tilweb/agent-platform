/**
 * AudioPlayer Component
 * Inline audio player for chat messages with play/pause, progress bar, and duration display
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { theme } from '../config/theme';
import { DownloadIcon } from './Icons';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  playButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    transition: `all ${theme.transitions.fast}`,
  },
  playButtonDisabled: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
    cursor: 'not-allowed',
  },
  progressContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    minWidth: 0,
  },
  filename: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  progress: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    transition: 'width 100ms linear',
  },
  time: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
    flexShrink: 0,
  },
  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    transition: `all ${theme.transitions.fast}`,
  },
};

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ url, filename, onAddToCollection }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError('Audio konnte nicht geladen werden');
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isLoading || error) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error('Audio play failed:', err);
        setError('Wiedergabe fehlgeschlagen');
      });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, isLoading, error]);

  const handleProgressClick = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'audio.m4a';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [url, filename]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={styles.container}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        style={{ display: 'none' }}
      />

      <button
        style={{
          ...styles.playButton,
          ...(isLoading || error ? styles.playButtonDisabled : {}),
        }}
        onClick={togglePlay}
        disabled={isLoading || !!error}
        onMouseOver={(e) => {
          if (!isLoading && !error) {
            e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
          }
        }}
        onMouseOut={(e) => {
          if (!isLoading && !error) {
            e.currentTarget.style.backgroundColor = theme.colors.primary;
          }
        }}
        title={isPlaying ? 'Pause' : 'Abspielen'}
      >
        {isLoading ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" style={{ animation: 'spin 1s linear infinite' }} />
          </svg>
        ) : isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      <div style={styles.progressContainer}>
        <span style={styles.filename} title={filename}>
          {filename}
        </span>
        {error ? (
          <span style={styles.errorText}>{error}</span>
        ) : (
          <div style={styles.progressBar} onClick={handleProgressClick}>
            <div style={{ ...styles.progress, width: `${progress}%` }} />
          </div>
        )}
      </div>

      <span style={styles.time}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {onAddToCollection && (
        <button
          style={styles.actionButton}
          onClick={onAddToCollection}
          title="Zu Materialien hinzufügen"
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      <button
        style={styles.actionButton}
        onClick={handleDownload}
        title="Herunterladen"
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <DownloadIcon size={16} />
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AudioPlayer;
