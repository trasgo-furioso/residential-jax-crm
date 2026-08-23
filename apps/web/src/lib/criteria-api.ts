'use client';

import type { CriteriaFilters } from '@/lib/duckdb';

/**
 * Lightweight client for saved criteria CRUD via the tRPC HTTP API.
 * Uses plain fetch against the tRPC batch endpoint to avoid requiring
 * the full tRPC React + React Query provider setup.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface SavedCriteriaRecord {
  id: string;
  name: string;
  filters: CriteriaFilters;
  geographic_bounds: { north: number; south: number; east: number; west: number } | null;
  notifications_enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

async function trpcQuery<T>(path: string, input?: unknown): Promise<T> {
  const url = new URL(`${API_URL}/${path}`);
  if (input !== undefined) {
    url.searchParams.set('input', JSON.stringify(input));
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
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const body = await res.json();
  return body.result?.data?.json ?? body.result?.data ?? body;
}

export async function listSavedCriteria(): Promise<SavedCriteriaRecord[]> {
  return trpcQuery<SavedCriteriaRecord[]>('criteria.list');
}

export async function createSavedCriteria(data: {
  name: string;
  filters: CriteriaFilters;
  geographic_bounds?: { north: number; south: number; east: number; west: number } | null;
  notifications_enabled?: boolean;
}): Promise<SavedCriteriaRecord> {
  return trpcMutate<SavedCriteriaRecord>('criteria.create', data);
}

export async function deleteSavedCriteria(id: string): Promise<void> {
  await trpcMutate('criteria.delete', { id });
}

export type { SavedCriteriaRecord };
