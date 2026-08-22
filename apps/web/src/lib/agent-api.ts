'use client';

/**
 * Client for the agent chat tRPC mutation.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface AgentProperty {
  parcel_id: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  assessed_value: number;
  market_value: number;
  current_owner_name: string;
  lat: number;
  lng: number;
  year_built: number;
  sqft: number;
  roof_age_years: number;
  ownership_tenure_years: number;
  is_regional_owner: boolean;
  water_proximity_ft: number;
  transit_distance_mi: number;
  provenance_sources: string;
  provenance_last_run: string;
}

export interface AgentResponse {
  response: string;
  properties: AgentProperty[];
  toolCalls: unknown[];
}

export async function agentChat(message: string): Promise<AgentResponse> {
  const res = await fetch(`${API_URL}/trpc/agent.chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: { message } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Agent API error: ${res.status} ${text}`);
  }
  const body = await res.json();
  return body.result?.data?.json ?? body.result?.data ?? body;
}
