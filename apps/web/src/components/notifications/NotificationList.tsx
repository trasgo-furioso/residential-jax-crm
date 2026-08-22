'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listNotifications,
  markNotificationAsRead,
  type NotificationRecord,
} from '@/lib/notifications-api';

interface NotificationListProps {
  criteriaFilter?: string | null;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationList({
  criteriaFilter,
  dateRangeStart,
  dateRangeEnd,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await listNotifications();
      setNotifications(data.notifications);
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNotificationClick = useCallback(
    async (notification: NotificationRecord) => {
      // Mark as read
      if (!notification.read) {
        try {
          await markNotificationAsRead(notification.id);
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
          );
        } catch {
          // Ignore
        }
      }

      // Navigate to dashboard with matched properties highlighted
      const parcelIds = notification.matched_parcel_ids ?? [];
      if (parcelIds.length > 0) {
        const params = new URLSearchParams();
        params.set('highlight', parcelIds.join(','));
        if (notification.criteria_id) {
          params.set('criteria', notification.criteria_id);
        }
        window.location.href = `/?${params.toString()}`;
      }
    },
    [],
  );

  // Apply filters
  let filtered = notifications;

  if (criteriaFilter) {
    filtered = filtered.filter((n) => n.criteria_id === criteriaFilter);
  }

  if (dateRangeStart) {
    const start = new Date(dateRangeStart).getTime();
    filtered = filtered.filter(
      (n) => n.created_at && new Date(n.created_at).getTime() >= start,
    );
  }

  if (dateRangeEnd) {
    const end = new Date(dateRangeEnd).getTime() + 86_400_000; // Include full day
    filtered = filtered.filter(
      (n) => n.created_at && new Date(n.created_at).getTime() <= end,
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        Loading notifications...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        No notifications found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {filtered.map((n) => (
        <div
          key={n.id}
          onClick={() => handleNotificationClick(n)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNotificationClick(n);
          }}
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #eee',
            background: n.read ? '#fff' : '#f0f6ff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            transition: 'background-color 0.15s',
          }}
        >
          {/* Unread indicator */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: n.read ? 'transparent' : '#3182ce',
              marginTop: 6,
              flexShrink: 0,
            }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Summary */}
            <div
              style={{
                fontSize: 14,
                fontWeight: n.read ? 400 : 600,
                marginBottom: 4,
                color: '#1a1a2e',
              }}
            >
              {n.summary ?? 'Pipeline notification'}
            </div>

            {/* Meta info row */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                fontSize: 12,
                color: '#888',
                flexWrap: 'wrap',
              }}
            >
              {n.run_id && (
                <span>
                  Run: {n.run_id.slice(0, 8)}...
                </span>
              )}
              {n.matched_count !== null && (
                <span>
                  {n.matched_count} matched
                </span>
              )}
              <span>{formatTimestamp(n.created_at)}</span>
            </div>
          </div>

          {/* Status badge */}
          <div
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              background: n.read ? '#f0f0f0' : '#e2ecf8',
              color: n.read ? '#999' : '#3182ce',
              fontWeight: 500,
              flexShrink: 0,
              alignSelf: 'center',
            }}
          >
            {n.read ? 'Read' : 'New'}
          </div>
        </div>
      ))}
    </div>
  );
}
