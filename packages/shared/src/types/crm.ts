export type OpportunityStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'offer_sent'
  | 'negotiating'
  | 'under_contract'
  | 'closed_won'
  | 'closed_lost';

export type OutreachChannel = 'email' | 'sms' | 'direct_mail';

export type OutreachStatus = 'sent' | 'delivered' | 'replied' | 'bounced';

export interface Opportunity {
  id: string;
  parcel_id: string;
  stage: OpportunityStage;
  owner_name: string;
  owner_phone: string | null;
  owner_email: string | null;
  asking_price: number | null;
  offer_amount: number | null;
  notes: string;
  next_steps: string;
  criteria_match_score: number;
  source_criteria_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachRecord {
  id: string;
  opportunity_id: string;
  channel: OutreachChannel;
  status: OutreachStatus;
  recipient: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  opportunity_id: string;
  title: string;
  assignee: string;
  due_date: string;
  completed: boolean;
}

export interface SavedCriteria {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  geographic_bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  criteria_id: string;
  event_id: string;
  run_id: string;
  matched_count: number;
  matched_parcel_ids: string[];
  summary: string;
  read: boolean;
  created_at: string;
}
