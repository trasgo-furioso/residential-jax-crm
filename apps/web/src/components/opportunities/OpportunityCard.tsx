'use client';

import type { OpportunityRecord } from '@/lib/opportunities-api';

interface OpportunityCardProps {
  opportunity: OpportunityRecord;
  selected?: boolean;
  onClick?: () => void;
}

const stageColors: Record<string, { bg: string; text: string }> = {
  identified: { bg: '#e5e7eb', text: '#374151' },
  contacted: { bg: '#dbeafe', text: '#1e40af' },
  negotiating: { bg: '#fef3c7', text: '#92400e' },
  under_contract: { bg: '#ffedd5', text: '#9a3412' },
  closed: { bg: '#d1fae5', text: '#065f46' },
  dead: { bg: '#fee2e2', text: '#991b1b' },
};

const stageLabels: Record<string, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  under_contract: 'Under Contract',
  closed: 'Closed',
  dead: 'Dead',
};

function formatCurrency(value: string | null): string {
  if (!value) return '--';
  const num = Number(value);
  if (isNaN(num)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(value: string | null): string {
  if (!value) return '--';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function OpportunityCard({
  opportunity,
  selected = false,
  onClick,
}: OpportunityCardProps) {
  const colors = stageColors[opportunity.stage] ?? stageColors.identified;
  const scoreNum = opportunity.criteria_match_score
    ? Number(opportunity.criteria_match_score)
    : null;

  return (
    <div
      onClick={onClick}
      style={{
        padding: 14,
        backgroundColor: selected ? '#f0f4ff' : '#ffffff',
        border: selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        marginBottom: 8,
      }}
    >
      {/* Top row: stage badge + score */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: colors.bg,
            color: colors.text,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {stageLabels[opportunity.stage] ?? opportunity.stage}
        </span>
        {scoreNum !== null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: scoreNum >= 70 ? '#059669' : scoreNum >= 40 ? '#d97706' : '#6b7280',
            }}
          >
            {scoreNum.toFixed(0)}% match
          </span>
        )}
      </div>

      {/* Address */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 4,
        }}
      >
        {opportunity.address || opportunity.parcel_id}
      </div>

      {/* Owner */}
      {opportunity.owner_name && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
          {opportunity.owner_name}
        </div>
      )}

      {/* Price row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#4b5563',
        }}
      >
        <span>Ask: {formatCurrency(opportunity.asking_price)}</span>
        <span>Offer: {formatCurrency(opportunity.offer_amount)}</span>
      </div>

      {/* Updated timestamp */}
      <div
        style={{
          fontSize: 11,
          color: '#9ca3af',
          marginTop: 6,
          textAlign: 'right',
        }}
      >
        Updated {formatDate(opportunity.updated_at)}
      </div>
    </div>
  );
}
