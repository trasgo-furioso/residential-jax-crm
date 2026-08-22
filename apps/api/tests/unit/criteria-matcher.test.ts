import { describe, it, expect } from 'vitest';
import {
  evaluateMatch,
  type CriteriaFilters,
} from '../../src/services/criteria-matcher.js';

describe('evaluateMatch', () => {
  const fullProperty = {
    ownership_tenure_years: 15,
    roof_age_years: 20,
    address_zip: '32205',
    assessed_value: 250_000,
    is_regional_owner: true,
    water_proximity_ft: 500,
  };

  const allFilters: CriteriaFilters = {
    ownership_tenure_min_years: 10,
    roof_age_min_years: 15,
    zip_codes: ['32205', '32210'],
    assessed_value_min: 100_000,
    assessed_value_max: 500_000,
    is_regional_owner: true,
    water_proximity_max_ft: 1000,
  };

  it('returns 100% when all criteria are met', () => {
    const result = evaluateMatch(fullProperty, allFilters);
    expect(result.percentage).toBe(100);
    expect(result.score).toBe(result.total);
    expect(result.breakdown.every((b) => b.met)).toBe(true);
  });

  it('returns 0% when no criteria are met', () => {
    const badProperty = {
      ownership_tenure_years: 1,       // < 10 → not met
      roof_age_years: 2,               // < 15 → not met
      address_zip: '99999',            // not in [32205, 32210] → not met
      assessed_value: 50,              // < 100_000 min → not met
      is_regional_owner: false,        // !== true → not met
      water_proximity_ft: 50_000,      // > 1000 → not met
    };
    // Use only filters where the bad property fails all of them
    const failAllFilters: CriteriaFilters = {
      ownership_tenure_min_years: 10,
      roof_age_min_years: 15,
      zip_codes: ['32205', '32210'],
      assessed_value_min: 100_000,
      // Omit assessed_value_max since 50 <= 500_000 would pass
      is_regional_owner: true,
      water_proximity_max_ft: 1000,
    };
    const result = evaluateMatch(badProperty, failAllFilters);
    expect(result.percentage).toBe(0);
    expect(result.score).toBe(0);
    expect(result.breakdown.every((b) => !b.met)).toBe(true);
  });

  it('returns correct partial match score (3 of 5 = 60%)', () => {
    // Use 5 criteria, property meets exactly 3
    const filters: CriteriaFilters = {
      ownership_tenure_min_years: 10, // met (15 >= 10)
      roof_age_min_years: 25,         // NOT met (20 < 25)
      zip_codes: ['32205'],           // met
      assessed_value_min: 200_000,    // met (250k >= 200k)
      assessed_value_max: 200_000,    // NOT met (250k > 200k)
    };
    const result = evaluateMatch(fullProperty, filters);
    expect(result.total).toBe(5);
    expect(result.score).toBe(3);
    expect(result.percentage).toBe(60);
  });

  it('returns 0% with empty/no filters (0/0 edge case)', () => {
    const result = evaluateMatch(fullProperty, {});
    expect(result.total).toBe(0);
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it('returns 100% with a single met criterion', () => {
    const filters: CriteriaFilters = {
      ownership_tenure_min_years: 10,
    };
    const result = evaluateMatch(fullProperty, filters);
    expect(result.total).toBe(1);
    expect(result.score).toBe(1);
    expect(result.percentage).toBe(100);
  });

  it('returns 0% with a single unmet criterion', () => {
    const filters: CriteriaFilters = {
      ownership_tenure_min_years: 100,
    };
    const result = evaluateMatch(fullProperty, filters);
    expect(result.total).toBe(1);
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it('provides correct breakdown per criterion', () => {
    const filters: CriteriaFilters = {
      ownership_tenure_min_years: 10, // met
      roof_age_min_years: 25,         // not met
      assessed_value_min: 200_000,    // met
    };
    const result = evaluateMatch(fullProperty, filters);
    expect(result.breakdown).toHaveLength(3);

    const tenureCrit = result.breakdown.find(
      (b) => b.criterion === 'ownership_tenure_min_years',
    );
    expect(tenureCrit?.met).toBe(true);

    const roofCrit = result.breakdown.find(
      (b) => b.criterion === 'roof_age_min_years',
    );
    expect(roofCrit?.met).toBe(false);

    const valueCrit = result.breakdown.find(
      (b) => b.criterion === 'assessed_value_min',
    );
    expect(valueCrit?.met).toBe(true);
  });

  it('handles missing property fields gracefully', () => {
    const emptyProp = {};
    const filters: CriteriaFilters = {
      ownership_tenure_min_years: 10,
      assessed_value_min: 100_000,
    };
    const result = evaluateMatch(emptyProp, filters);
    expect(result.total).toBe(2);
    // defaults to 0, so 0 < 10 and 0 < 100_000 → both not met
    expect(result.score).toBe(0);
    expect(result.percentage).toBe(0);
  });
});
