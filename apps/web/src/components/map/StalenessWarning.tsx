'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface StalenessWarningProps {
  /** Whether DuckDB/Parquet load failed */
  loadFailed: boolean;
  /** Timestamp of last successful data load (epoch ms), or null if never loaded */
  lastLoadTime: number | null;
  /** Callback to retry loading data */
  onRetry: () => Promise<void>;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETRY_INTERVAL_MS = 60 * 1000; // 60 seconds

export default function StalenessWarning({
  loadFailed,
  lastLoadTime,
  onRetry,
}: StalenessWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isStale =
    lastLoadTime != null && Date.now() - lastLoadTime > STALE_THRESHOLD_MS;

  const shouldShow = (loadFailed || isStale) && !dismissed;

  const doRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // Retry failed silently; banner stays visible
    } finally {
      setRetrying(false);
    }
  }, [onRetry, retrying]);

  // Auto-retry every 60s when banner is showing
  useEffect(() => {
    if (!shouldShow) {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      return;
    }

    retryTimerRef.current = setInterval(() => {
      void doRetry();
    }, RETRY_INTERVAL_MS);

    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [shouldShow, doRetry]);

  // Re-show banner if condition changes after dismiss
  useEffect(() => {
    if (loadFailed || isStale) {
      setDismissed(false);
    }
  }, [loadFailed, isStale]);

  if (!shouldShow) return null;

  const formattedTime = lastLoadTime
    ? new Date(lastLoadTime).toLocaleString()
    : 'never';

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#fef3c7',
        borderBottom: '1px solid #f59e0b',
        fontSize: 13,
        color: '#92400e',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <span style={{ fontSize: 16 }} aria-hidden="true">
          &#9888;
        </span>
        <span>
          Property data may be stale. Last updated: {formattedTime}.
          {retrying ? ' Retrying...' : ' Retrying in background...'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => void doRetry()}
          disabled={retrying}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid #d97706',
            borderRadius: 4,
            backgroundColor: retrying ? '#fde68a' : '#ffffff',
            color: '#92400e',
            cursor: retrying ? 'not-allowed' : 'pointer',
          }}
        >
          {retrying ? 'Retrying...' : 'Retry Now'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            padding: '4px 8px',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            background: 'none',
            color: '#92400e',
            cursor: 'pointer',
            lineHeight: 1,
          }}
          aria-label="Dismiss staleness warning"
        >
          &#215;
        </button>
      </div>
    </div>
  );
}
