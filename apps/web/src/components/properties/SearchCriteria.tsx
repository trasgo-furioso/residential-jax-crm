'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CriteriaFilters } from '@/lib/duckdb';
import {
  listSavedCriteria,
  createSavedCriteria,
  deleteSavedCriteria,
} from '@/lib/criteria-api';
import type { SavedCriteriaRecord } from '@/lib/criteria-api';

interface SearchCriteriaProps {
  onApply: (filters: CriteriaFilters) => void;
  onClear: () => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  backgroundColor: '#ffffff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: '#fee2e2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  borderRadius: 4,
  cursor: 'pointer',
};

export default function SearchCriteria({ onApply, onClear }: SearchCriteriaProps) {
  // Form state
  const [ownershipTenure, setOwnershipTenure] = useState('');
  const [roofAge, setRoofAge] = useState('');
  const [zipCodes, setZipCodes] = useState('');
  const [assessedValueMin, setAssessedValueMin] = useState('');
  const [assessedValueMax, setAssessedValueMax] = useState('');
  const [isRegionalOwner, setIsRegionalOwner] = useState(false);
  const [waterProximity, setWaterProximity] = useState('');

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<SavedCriteriaRecord[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  // Load saved searches on mount
  useEffect(() => {
    listSavedCriteria()
      .then(setSavedSearches)
      .catch(() => {
        /* API may not be available */
      });
  }, []);

  const buildFilters = useCallback((): CriteriaFilters => {
    const filters: CriteriaFilters = {};
    if (ownershipTenure) filters.ownership_tenure_min_years = Number(ownershipTenure);
    if (roofAge) filters.roof_age_min_years = Number(roofAge);
    if (zipCodes.trim()) {
      filters.zip_codes = zipCodes
        .split(',')
        .map((z) => z.trim())
        .filter(Boolean);
    }
    if (assessedValueMin) filters.assessed_value_min = Number(assessedValueMin);
    if (assessedValueMax) filters.assessed_value_max = Number(assessedValueMax);
    if (isRegionalOwner) filters.is_regional_owner = true;
    if (waterProximity) filters.water_proximity_max_ft = Number(waterProximity);
    return filters;
  }, [ownershipTenure, roofAge, zipCodes, assessedValueMin, assessedValueMax, isRegionalOwner, waterProximity]);

  const handleApply = useCallback(() => {
    onApply(buildFilters());
  }, [onApply, buildFilters]);

  const handleClear = useCallback(() => {
    setOwnershipTenure('');
    setRoofAge('');
    setZipCodes('');
    setAssessedValueMin('');
    setAssessedValueMax('');
    setIsRegionalOwner(false);
    setWaterProximity('');
    onClear();
  }, [onClear]);

  const loadFilters = useCallback((filters: CriteriaFilters) => {
    setOwnershipTenure(filters.ownership_tenure_min_years?.toString() ?? '');
    setRoofAge(filters.roof_age_min_years?.toString() ?? '');
    setZipCodes(filters.zip_codes?.join(', ') ?? '');
    setAssessedValueMin(filters.assessed_value_min?.toString() ?? '');
    setAssessedValueMax(filters.assessed_value_max?.toString() ?? '');
    setIsRegionalOwner(filters.is_regional_owner ?? false);
    setWaterProximity(filters.water_proximity_max_ft?.toString() ?? '');
  }, []);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    try {
      const record = await createSavedCriteria({
        name: saveName.trim(),
        filters: buildFilters(),
      });
      setSavedSearches((prev) => [...prev, record]);
      setSaveName('');
      setShowSaveInput(false);
    } catch {
      /* ignore API errors for now */
    }
  }, [saveName, buildFilters]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteSavedCriteria(id);
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    } catch {
      /* ignore */
    }
  }, []);

  const handleRecall = useCallback(
    (record: SavedCriteriaRecord) => {
      loadFilters(record.filters);
      onApply(record.filters);
    },
    [loadFilters, onApply],
  );

  return (
    <div
      style={{
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
          padding: '8px 16px',
          borderBottom: collapsed ? 'none' : '1px solid #e5e7eb',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
          Search Criteria
        </span>
        <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, transition: 'transform 0.15s', display: 'inline-block', transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>
          &#9654;
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '10px 16px' }}>
          {/* Saved searches dropdown */}
          {savedSearches.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Saved Searches</label>
              <div
                style={{
                  maxHeight: 120,
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                }}
              >
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: 500, flex: 1 }}
                      onClick={() => handleRecall(s)}
                      title="Click to load and apply this search"
                    >
                      {s.name}
                    </span>
                    <button style={btnDanger} onClick={() => handleDelete(s.id)}>
                      Del
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Ownership Tenure (min yrs)</label>
              <input
                type="number"
                style={inputStyle}
                value={ownershipTenure}
                onChange={(e) => setOwnershipTenure(e.target.value)}
                placeholder="e.g. 10"
                min={0}
              />
            </div>
            <div>
              <label style={labelStyle}>Roof Age (min yrs)</label>
              <input
                type="number"
                style={inputStyle}
                value={roofAge}
                onChange={(e) => setRoofAge(e.target.value)}
                placeholder="e.g. 15"
                min={0}
              />
            </div>
            <div>
              <label style={labelStyle}>Assessed Value Min ($)</label>
              <input
                type="number"
                style={inputStyle}
                value={assessedValueMin}
                onChange={(e) => setAssessedValueMin(e.target.value)}
                placeholder="e.g. 100000"
                min={0}
              />
            </div>
            <div>
              <label style={labelStyle}>Assessed Value Max ($)</label>
              <input
                type="number"
                style={inputStyle}
                value={assessedValueMax}
                onChange={(e) => setAssessedValueMax(e.target.value)}
                placeholder="e.g. 500000"
                min={0}
              />
            </div>
            <div>
              <label style={labelStyle}>Water Proximity (max ft)</label>
              <input
                type="number"
                style={inputStyle}
                value={waterProximity}
                onChange={(e) => setWaterProximity(e.target.value)}
                placeholder="e.g. 1000"
                min={0}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isRegionalOwner}
                  onChange={(e) => setIsRegionalOwner(e.target.checked)}
                />
                Regional Owner
              </label>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Zip Codes (comma-separated)</label>
              <input
                type="text"
                style={inputStyle}
                value={zipCodes}
                onChange={(e) => setZipCodes(e.target.value)}
                placeholder="e.g. 32202, 32204, 32210"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btnPrimary} onClick={handleApply}>
              Apply
            </button>
            <button style={btnSecondary} onClick={handleClear}>
              Clear
            </button>
            {!showSaveInput ? (
              <button style={btnSecondary} onClick={() => setShowSaveInput(true)}>
                Save Search
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="text"
                  style={{ ...inputStyle, width: 140 }}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Search name"
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <button style={btnPrimary} onClick={handleSave}>
                  Save
                </button>
                <button
                  style={btnSecondary}
                  onClick={() => {
                    setShowSaveInput(false);
                    setSaveName('');
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
