'use client';

/**
 * Lightweight client for notifications via the tRPC HTTP API.
 * Uses plain fetch against the tRPC endpoint (same pattern as criteria-api.ts).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface NotificationRecord {
  id: string;
  criteria_id: string | null;
  event_id: string | null;
  run_id: string | null;
  matched_count: number | null;
  matched_parcel_ids: string[] | null;
  summary: string | null;
  read: boolean | null;
  created_at: string | null;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
  unread_count: number;
}

async function trpcQuery<T>(path: string, input?: unknown): Promise<T> {
  const url = new URL(`${API_URL}/${path}`);
  if (input !== undefined) {
    url.searchParams.set('input', JSON.stringify({ json: input }));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const body = await res.json();
  return body.result?.data?.json ?? body.result?.data ?? body;
}

async function trpcMutate<T>(path: string, input: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: input }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const body = await res.json();
  return body.result?.data?.json ?? body.result?.data ?? body;
}

export async function listNotifications(): Promise<NotificationListResponse> {
  return trpcQuery<NotificationListResponse>('notifications.list');
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await trpcMutate('notifications.markAsRead', { id });
}

export async function markAllNotificationsRead(): Promise<void> {
  await trpcMutate('notifications.markAllRead', {});
}
