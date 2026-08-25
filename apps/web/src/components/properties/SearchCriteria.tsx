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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto' as const,
};

const toggleTrack: React.CSSProperties = {
  position: 'relative',
  width: 40,
  height: 20,
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  flexShrink: 0,
};

const toggleThumb: React.CSSProperties = {
  position: 'absolute',
  top: 2,
  width: 16,
  height: 16,
  borderRadius: '50%',
  backgroundColor: '#ffffff',
  transition: 'left 0.2s',
  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
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
            {/* Row 1: Ownership Tenure | Roof Age | Water Proximity */}
            <div>
              <label style={labelStyle}>Min Ownership (yrs)</label>
              <select
                style={selectStyle}
                value={ownershipTenure}
                onChange={(e) => setOwnershipTenure(e.target.value)}
              >
                <option value="">Any</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="40">40</option>
                <option value="50">50</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Min Roof Age (yrs)</label>
              <select
                style={selectStyle}
                value={roofAge}
                onChange={(e) => setRoofAge(e.target.value)}
              >
                <option value="">Any</option>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="40">40</option>
                <option value="50">50</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Max Water Proximity (ft)</label>
              <select
                style={selectStyle}
                value={waterProximity}
                onChange={(e) => setWaterProximity(e.target.value)}
              >
                <option value="">Any</option>
                <option value="500">500</option>
                <option value="1000">1,000</option>
                <option value="2000">2,000</option>
                <option value="3000">3,000</option>
                <option value="5000">5,000</option>
                <option value="10000">10,000</option>
              </select>
            </div>

            {/* Row 2: Assessed Value Min—Max | Regional Owner toggle */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Assessed Value ($)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  style={{ ...inputStyle, flex: 1 }}
                  value={assessedValueMin}
                  onChange={(e) => setAssessedValueMin(e.target.value)}
                  placeholder="Min $"
                  min={0}
                />
                <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0 }}>&mdash;</span>
                <input
                  type="number"
                  style={{ ...inputStyle, flex: 1 }}
                  value={assessedValueMax}
                  onChange={(e) => setAssessedValueMax(e.target.value)}
                  placeholder="Max $"
                  min={0}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  role="switch"
                  aria-checked={isRegionalOwner}
                  tabIndex={0}
                  style={{
                    ...toggleTrack,
                    backgroundColor: isRegionalOwner ? '#3b82f6' : '#d1d5db',
                  }}
                  onClick={() => setIsRegionalOwner((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsRegionalOwner((v) => !v);
                    }
                  }}
                >
                  <div
                    style={{
                      ...toggleThumb,
                      left: isRegionalOwner ? 22 : 2,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Regional Owner
                </span>
              </div>
            </div>

            {/* Row 3: Zip Codes (full width) */}
            <div style={{ gridColumn: 'span 3' }}>
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
