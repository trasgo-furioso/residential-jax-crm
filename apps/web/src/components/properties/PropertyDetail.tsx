'use client';

import { useState } from 'react';
import { createOpportunity } from '@/lib/opportunities-api';

interface PropertyData {
  parcel_id: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  assessed_value: number;
  market_value: number;
  current_owner_name: string;
  year_built: number;
  sqft: number;
  roof_age_years: number;
  ownership_tenure_years: number;
  is_regional_owner: boolean;
  water_proximity_ft: number;
  transit_distance_mi: number;
  lat: number;
  lng: number;
  provenance_sources: string;
  provenance_last_run: string;
  provenance_timestamps: string;
}

interface PropertyDetailProps {
  property: PropertyData;
  onClose?: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
  paddingBottom: 4,
  borderBottom: '1px solid #e5e7eb',
};

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '3px 0',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  color: '#6b7280',
};

const valueStyle: React.CSSProperties = {
  color: '#1f2937',
  fontWeight: 500,
  textAlign: 'right',
};

function Field({ label, value }: { label: string; value: string | number | boolean }) {
  const display =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
  return (
    <div style={fieldRowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{display}</span>
    </div>
  );
}

export default function PropertyDetail({ property, onClose }: PropertyDetailProps) {
  const [createStatus, setCreateStatus] = useState<
    'idle' | 'loading' | 'success' | 'exists'
  >('idle');
  const [, setExistingOppId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCreateOpportunity() {
    setCreateStatus('loading');
    setErrorMsg(null);
    try {
      const result = await createOpportunity({
        parcel_id: property.parcel_id,
      });
      if (result.exists) {
        setCreateStatus('exists');
        setExistingOppId(result.opportunity.id);
      } else {
        setCreateStatus('success');
        setExistingOppId(result.opportunity.id);
      }
    } catch (err) {
      setCreateStatus('idle');
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to create opportunity',
      );
    }
  }

  const sources = property.provenance_sources
    ? property.provenance_sources.split(',').map((s) => s.trim())
    : [];

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
        padding: 20,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: '#1f2937',
            }}
          >
            {property.address_street}
          </h2>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {property.address_city}, FL {property.address_zip}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#9ca3af',
              marginTop: 4,
              fontFamily: 'monospace',
            }}
          >
            Parcel: {property.parcel_id}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: '#9ca3af',
              padding: '0 4px',
            }}
            aria-label="Close detail panel"
          >
            x
          </button>
        )}
      </div>

      {/* Value Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Valuation</div>
        <Field label="Assessed Value" value={formatCurrency(property.assessed_value)} />
        <Field label="Market Value" value={formatCurrency(property.market_value)} />
      </div>

      {/* Owner Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Ownership</div>
        <Field label="Current Owner" value={property.current_owner_name} />
        <Field label="Tenure" value={`${property.ownership_tenure_years} years`} />
        <Field label="Regional Owner" value={property.is_regional_owner} />
      </div>

      {/* Property Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Property</div>
        <Field label="Year Built" value={property.year_built} />
        <Field label="Square Feet" value={property.sqft?.toLocaleString() ?? '—'} />
        <Field label="Roof Age" value={`${property.roof_age_years} years`} />
      </div>

      {/* Location Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Location</div>
        <Field label="Coordinates" value={property.lat != null && property.lng != null ? `${property.lat.toFixed(5)}, ${property.lng.toFixed(5)}` : '—'} />
        <Field label="Water Proximity" value={property.water_proximity_ft != null ? `${property.water_proximity_ft.toLocaleString()} ft` : '—'} />
        <Field label="Transit Distance" value={property.transit_distance_mi != null ? `${property.transit_distance_mi.toFixed(1)} mi` : '—'} />
      </div>

      {/* Provenance Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Provenance</div>
        <div style={{ fontSize: 13 }}>
          <div style={{ ...fieldRowStyle, flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <span style={labelStyle}>Contributing Sources</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sources.map((src) => (
                <span
                  key={src}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: 4,
                    fontSize: 11,
                    color: '#4b5563',
                  }}
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
          <Field label="Last Pipeline Run" value={property.provenance_last_run || 'N/A'} />
          <Field label="Collection Timestamps" value={property.provenance_timestamps || 'N/A'} />
        </div>
      </div>

      {/* Create Opportunity CTA */}
      {createStatus === 'success' ? (
        <div
          style={{
            marginTop: 8,
            padding: '10px 16px',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          Opportunity created successfully!{' '}
          <a
            href="/opportunities"
            style={{ color: '#047857', fontWeight: 600 }}
          >
            View Opportunities
          </a>
        </div>
      ) : createStatus === 'exists' ? (
        <div
          style={{
            marginTop: 8,
            padding: '10px 16px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          An opportunity already exists for this parcel.{' '}
          <a
            href="/opportunities"
            style={{ color: '#b45309', fontWeight: 600 }}
          >
            View Opportunity
          </a>
        </div>
      ) : (
        <button
          style={{
            width: '100%',
            padding: '10px 16px',
            backgroundColor:
              createStatus === 'loading' ? '#93c5fd' : '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor:
              createStatus === 'loading' ? 'not-allowed' : 'pointer',
            marginTop: 8,
          }}
          onClick={handleCreateOpportunity}
          disabled={createStatus === 'loading'}
        >
          {createStatus === 'loading'
            ? 'Creating...'
            : 'Create Opportunity'}
        </button>
      )}
      {errorMsg && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: '#dc2626',
            textAlign: 'center',
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
