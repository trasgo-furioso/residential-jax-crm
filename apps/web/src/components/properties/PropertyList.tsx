'use client';

import { useState, useMemo, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface PropertyRow {
  parcel_id: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  assessed_value: number;
  current_owner_name: string;
  ownership_tenure_years: number;
  roof_age_years: number;
  match_score?: number;
}

interface PropertyListProps {
  properties: PropertyRow[];
  onPropertySelect?: (parcelId: string) => void;
  selectedParcelId?: string | null;
  showMatchScore?: boolean;
}

type SortField =
  | 'parcel_id'
  | 'address'
  | 'current_owner_name'
  | 'assessed_value'
  | 'ownership_tenure_years'
  | 'roof_age_years'
  | 'match_score';

type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '2px solid #e5e7eb',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  backgroundColor: '#ffffff',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  color: '#374151',
  borderBottom: '1px solid #f3f4f6',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 200,
};

function MatchBadge({ score }: { score: number }) {
  const bg = score >= 80 ? '#dcfce7' : score >= 50 ? '#fef9c3' : '#fee2e2';
  const color = score >= 80 ? '#166534' : score >= 50 ? '#854d0e' : '#dc2626';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 10,
        backgroundColor: bg,
        color,
        minWidth: 32,
        textAlign: 'center',
      }}
    >
      {score}%
    </span>
  );
}

export default function PropertyList({
  properties,
  onPropertySelect,
  selectedParcelId,
  showMatchScore,
}: PropertyListProps) {
  const [sortField, setSortField] = useState<SortField>('parcel_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (properties.length === 0) return;
    setExporting(true);
    try {
      const parcel_ids = properties.map((p) => p.parcel_id);
      const result = await trpcMutate<{ csv: string; filename: string }>(
        'export.exportProperties',
        { parcel_ids },
      );
      downloadCsv(result.csv, result.filename);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [properties]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
      setPage(0);
    },
    [sortField],
  );

  const sorted = useMemo(() => {
    const copy = [...properties];
    copy.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === 'address') {
        aVal = `${a.address_street} ${a.address_city} ${a.address_zip}`;
        bVal = `${b.address_street} ${b.address_city} ${b.address_zip}`;
      } else {
        aVal = a[sortField] as string | number;
        bVal = b[sortField] as string | number;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [properties, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function sortIndicator(field: SortField): string {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ^' : ' v';
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
            Properties ({properties.length.toLocaleString()} total)
          </span>
          <button
            onClick={handleExport}
            disabled={exporting || properties.length === 0}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #d1d5db',
              borderRadius: 4,
              backgroundColor: exporting ? '#f3f4f6' : '#ffffff',
              color: exporting || properties.length === 0 ? '#9ca3af' : '#374151',
              cursor: exporting || properties.length === 0 ? 'default' : 'pointer',
            }}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: page === 0 ? '#f9fafb' : '#ffffff',
                cursor: page === 0 ? 'default' : 'pointer',
                color: page === 0 ? '#9ca3af' : '#374151',
              }}
            >
              Prev
            </button>
            <span style={{ color: '#6b7280' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: page >= totalPages - 1 ? '#f9fafb' : '#ffffff',
                cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                color: page >= totalPages - 1 ? '#9ca3af' : '#374151',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr>
              <th style={thStyle} onClick={() => handleSort('parcel_id')}>
                Parcel ID{sortIndicator('parcel_id')}
              </th>
              <th style={thStyle} onClick={() => handleSort('address')}>
                Address{sortIndicator('address')}
              </th>
              <th style={thStyle} onClick={() => handleSort('current_owner_name')}>
                Owner{sortIndicator('current_owner_name')}
              </th>
              <th
                style={{ ...thStyle, textAlign: 'right' }}
                onClick={() => handleSort('assessed_value')}
              >
                Assessed Value{sortIndicator('assessed_value')}
              </th>
              <th
                style={{ ...thStyle, textAlign: 'right' }}
                onClick={() => handleSort('ownership_tenure_years')}
              >
                Tenure (yr){sortIndicator('ownership_tenure_years')}
              </th>
              <th
                style={{ ...thStyle, textAlign: 'right' }}
                onClick={() => handleSort('roof_age_years')}
              >
                Roof Age (yr){sortIndicator('roof_age_years')}
              </th>
              {showMatchScore && (
                <th
                  style={{ ...thStyle, textAlign: 'center' }}
                  onClick={() => handleSort('match_score')}
                >
                  Match{sortIndicator('match_score')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => {
              const isSelected = p.parcel_id === selectedParcelId;
              return (
                <tr
                  key={p.parcel_id}
                  onClick={() => onPropertySelect?.(p.parcel_id)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>
                    {p.parcel_id}
                  </td>
                  <td style={tdStyle}>
                    {p.address_street}, {p.address_city} {p.address_zip}
                  </td>
                  <td style={tdStyle}>{p.current_owner_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatCurrency(p.assessed_value)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {p.ownership_tenure_years}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {p.roof_age_years}
                  </td>
                  {showMatchScore && (
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {p.match_score != null ? <MatchBadge score={p.match_score} /> : '-'}
                    </td>
                  )}
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td
                  colSpan={showMatchScore ? 7 : 6}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    color: '#9ca3af',
                    padding: 32,
                  }}
                >
                  No properties found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
