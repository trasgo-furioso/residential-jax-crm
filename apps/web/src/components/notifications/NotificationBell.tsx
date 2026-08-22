'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listNotifications,
  type NotificationRecord,
} from '@/lib/notifications-api';

const POLL_INTERVAL_MS = 30_000;

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationRecord[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await listNotifications();
      setUnreadCount(data.unread_count);
      setRecent(data.notifications.slice(0, 5));
    } catch {
      // Silently ignore fetch errors for polling
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px 8px',
          fontSize: 20,
        }}
      >
        {/* Bell SVG icon */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: '#e53e3e',
              color: '#fff',
              borderRadius: '50%',
              width: 18,
              height: 18,
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            width: 340,
            background: '#fff',
            border: '1px solid #e2e2e2',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eee',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span style={{ fontSize: 12, color: '#666' }}>
                {unreadCount} unread
              </span>
            )}
          </div>

          {recent.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#999', fontSize: 13 }}>
              No notifications yet
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 320, overflowY: 'auto' }}>
              {recent.map((n) => (
                <li
                  key={n.id}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid #f5f5f5',
                    background: n.read ? '#fff' : '#f0f6ff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, marginBottom: 2 }}>
                    {n.summary ?? 'Pipeline notification'}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {timeAgo(n.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <a
            href="/notifications"
            style={{
              display: 'block',
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: 13,
              color: '#3182ce',
              textDecoration: 'none',
              borderTop: '1px solid #eee',
              fontWeight: 500,
            }}
          >
            View All
          </a>
        </div>
      )}
    </div>
  );
}
