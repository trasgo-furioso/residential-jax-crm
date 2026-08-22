'use client';

interface PropertyMarkerProps {
  parcelId: string;
  address: string;
  assessedValue: number;
  onClose?: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PropertyMarker({
  parcelId,
  address,
  assessedValue,
  onClose,
}: PropertyMarkerProps) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 8,
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
        padding: '12px 16px',
        minWidth: 220,
        maxWidth: 300,
        fontSize: 13,
        lineHeight: 1.5,
        position: 'relative',
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: '#999',
            padding: '0 4px',
          }}
          aria-label="Close popup"
        >
          x
        </button>
      )}

      <div
        style={{
          fontSize: 11,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        Parcel {parcelId}
      </div>

      <div
        style={{
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 8,
        }}
      >
        {address}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Assessed Value
        </span>
        <span
          style={{
            fontWeight: 600,
            color: '#059669',
          }}
        >
          {formatCurrency(assessedValue)}
        </span>
      </div>
    </div>
  );
}
