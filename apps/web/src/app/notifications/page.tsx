'use client';

import { useState, useEffect, useCallback } from 'react';
import NotificationList from '@/components/notifications/NotificationList';
import {
  listNotifications,
  markAllNotificationsRead,
} from '@/lib/notifications-api';
import { listSavedCriteria, type SavedCriteriaRecord } from '@/lib/criteria-api';

export default function NotificationsPage() {
  const [criteriaFilter, setCriteriaFilter] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [criteriaOptions, setCriteriaOptions] = useState<SavedCriteriaRecord[]>([]);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const data = await listNotifications();
      setTotalCount(data.notifications.length);
      setUnreadCount(data.unread_count);
    } catch {
      // Ignore
    }
  }, []);

  const fetchCriteriaOptions = useCallback(async () => {
    try {
      const list = await listSavedCriteria();
      setCriteriaOptions(list);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    fetchCriteriaOptions();
  }, [fetchCounts, fetchCriteriaOptions]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      // Force re-render of NotificationList by toggling a key
      setForceRefresh((prev) => prev + 1);
    } catch {
      // Ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const [forceRefresh, setForceRefresh] = useState(0);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
            Notifications
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {totalCount} total &middot; {unreadCount} unread
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={markingAll || unreadCount === 0}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            background: unreadCount === 0 ? '#e0e0e0' : '#3b82f6',
            color: unreadCount === 0 ? '#999' : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: unreadCount === 0 ? 'default' : 'pointer',
          }}
        >
          {markingAll ? 'Marking...' : 'Mark All Read'}
        </button>
      </div>

      {/* Filter controls */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Criteria filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
            Criteria Set
          </label>
          <select
            value={criteriaFilter ?? ''}
            onChange={(e) => setCriteriaFilter(e.target.value || null)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              border: '1px solid #d1d5db',
              borderRadius: 4,
              minWidth: 180,
            }}
          >
            <option value="">All criteria</option>
            {criteriaOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date range start */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
            From
          </label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
        </div>

        {/* Date range end */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
            To
          </label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
        </div>

        {/* Clear filters */}
        {(criteriaFilter || dateStart || dateEnd) && (
          <button
            onClick={() => {
              setCriteriaFilter(null);
              setDateStart('');
              setDateEnd('');
            }}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#6b7280',
              alignSelf: 'flex-end',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Notification list */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <NotificationList
          key={forceRefresh}
          criteriaFilter={criteriaFilter}
          dateRangeStart={dateStart || null}
          dateRangeEnd={dateEnd || null}
        />
      </div>
    </div>
  );
}
