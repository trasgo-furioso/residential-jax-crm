'use client';

/**
 * Lightweight client for opportunities CRUD via the tRPC HTTP API.
 * Uses plain fetch against the tRPC endpoints.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function trpcQuery<T>(path: string, input?: unknown): Promise<T> {
  const url = new URL(`${API_URL}/trpc/${path}`);
  if (input !== undefined) {
    url.searchParams.set('input', JSON.stringify({ json: input }));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const body = await res.json();
  return body.result?.data?.json ?? body.result?.data ?? body;
}

async function trpcMutate<T>(path: string, input: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/trpc/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: input }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const body = await res.json();
  return body.result?.data?.json ?? body.result?.data ?? body;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type OpportunityStage =
  | 'identified'
  | 'contacted'
  | 'negotiating'
  | 'under_contract'
  | 'closed'
  | 'dead';

export interface OpportunityRecord {
  id: string;
  parcel_id: string;
  stage: OpportunityStage;
  owner_name: string | null;
  owner_contact_email: string | null;
  owner_contact_phone: string | null;
  owner_interest: string | null;
  asking_price: string | null;
  offer_amount: string | null;
  notes: string | null;
  next_steps: string | null;
  criteria_match_score: string | null;
  source_criteria_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface HistoryRecord {
  id: string;
  opportunity_id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  created_at: string | null;
}

export interface TaskRecord {
  id: string;
  opportunity_id: string;
  title: string;
  assignee: string | null;
  due_date: string | null;
  completed: boolean | null;
  created_at: string | null;
}

export interface OutreachRecord {
  id: string;
  opportunity_id: string;
  channel: string;
  status: string;
  recipient: string;
  subject: string | null;
  sent_at: string | null;
  status_updated_at: string | null;
}

export interface OpportunityDetail extends OpportunityRecord {
  history: HistoryRecord[];
  tasks: TaskRecord[];
  outreach: OutreachRecord[];
}

export interface CreateResult {
  exists: boolean;
  opportunity: OpportunityRecord;
}

export interface OpportunityFilters {
  stage?: string;
  zip?: string;
  min_score?: number;
  date_from?: string;
  date_to?: string;
}

// ── API functions ──────────────────────────────────────────────────────────

export async function listOpportunities(
  filters?: OpportunityFilters,
): Promise<OpportunityRecord[]> {
  return trpcQuery<OpportunityRecord[]>('opportunities.list', filters);
}

export async function createOpportunity(data: {
  parcel_id: string;
  source_criteria_id?: string;
  criteria_match_score?: number;
}): Promise<CreateResult> {
  return trpcMutate<CreateResult>('opportunities.create', data);
}

export async function getOpportunityById(
  id: string,
): Promise<OpportunityDetail | null> {
  return trpcQuery<OpportunityDetail | null>('opportunities.getById', { id });
}

export async function updateOpportunityStage(data: {
  id: string;
  stage: OpportunityStage;
  note?: string;
}): Promise<OpportunityRecord> {
  return trpcMutate<OpportunityRecord>('opportunities.updateStage', data);
}

export async function updateOpportunityDetails(data: {
  id: string;
  owner_contact_email?: string;
  owner_contact_phone?: string;
  owner_interest?: string;
  asking_price?: number;
  offer_amount?: number;
  notes?: string;
  next_steps?: string;
}): Promise<OpportunityRecord> {
  return trpcMutate<OpportunityRecord>('opportunities.updateDetails', data);
}

// ── Task API functions ─────────────────────────────────────────────────────

export async function listTasks(
  opportunity_id: string,
): Promise<TaskRecord[]> {
  return trpcQuery<TaskRecord[]>('opportunities.tasks.list', {
    opportunity_id,
  });
}

export async function createTask(data: {
  opportunity_id: string;
  title: string;
  assignee?: string;
  due_date?: string;
}): Promise<TaskRecord> {
  return trpcMutate<TaskRecord>('opportunities.tasks.create', data);
}

export async function toggleTask(id: string): Promise<TaskRecord> {
  return trpcMutate<TaskRecord>('opportunities.tasks.toggle', { id });
}
