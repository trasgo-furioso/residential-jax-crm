export interface DeltaSummary {
  new_count: number;
  updated_count: number;
  removed_count: number;
  new_parcel_ids: string[];
  updated_parcel_ids: string[];
  removed_parcel_ids: string[];
}

export interface WebhookEvent {
  event_id: string;
  event_type: string;
  county: string;
  run_id: string;
  ipns_pointer: string;
  artifact_cid: string;
  timestamp: string;
  delta: DeltaSummary;
}

export interface PipelineRun {
  run_id: string;
  county: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  delta: DeltaSummary | null;
  artifact_cid: string | null;
}
