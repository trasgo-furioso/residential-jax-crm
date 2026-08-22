/**
 * Criteria matcher service — evaluates how well a property matches a set of search filters.
 */

export interface CriteriaFilters {
  ownership_tenure_min_years?: number;
  roof_age_min_years?: number;
  zip_codes?: string[];
  assessed_value_min?: number;
  assessed_value_max?: number;
  is_regional_owner?: boolean;
  water_proximity_max_ft?: number;
}

export interface CriterionResult {
  criterion: string;
  met: boolean;
}

export interface MatchResult {
  score: number;
  total: number;
  percentage: number;
  breakdown: CriterionResult[];
}

interface PropertyLike {
  ownership_tenure_years?: number;
  roof_age_years?: number;
  address_zip?: string;
  assessed_value?: number;
  is_regional_owner?: boolean;
  water_proximity_ft?: number;
}

/**
 * Evaluate how well a property matches the given criteria filters.
 * Only criteria that are actually set (non-null/undefined) are counted.
 */
export function evaluateMatch(
  property: PropertyLike,
  filters: CriteriaFilters,
): MatchResult {
  const breakdown: CriterionResult[] = [];

  if (filters.ownership_tenure_min_years != null) {
    breakdown.push({
      criterion: 'ownership_tenure_min_years',
      met: (property.ownership_tenure_years ?? 0) >= filters.ownership_tenure_min_years,
    });
  }

  if (filters.roof_age_min_years != null) {
    breakdown.push({
      criterion: 'roof_age_min_years',
      met: (property.roof_age_years ?? 0) >= filters.roof_age_min_years,
    });
  }

  if (filters.zip_codes != null && filters.zip_codes.length > 0) {
    breakdown.push({
      criterion: 'zip_codes',
      met: filters.zip_codes.includes(property.address_zip ?? ''),
    });
  }

  if (filters.assessed_value_min != null) {
    breakdown.push({
      criterion: 'assessed_value_min',
      met: (property.assessed_value ?? 0) >= filters.assessed_value_min,
    });
  }

  if (filters.assessed_value_max != null) {
    breakdown.push({
      criterion: 'assessed_value_max',
      met: (property.assessed_value ?? Infinity) <= filters.assessed_value_max,
    });
  }

  if (filters.is_regional_owner != null) {
    breakdown.push({
      criterion: 'is_regional_owner',
      met: property.is_regional_owner === true,
    });
  }

  if (filters.water_proximity_max_ft != null) {
    breakdown.push({
      criterion: 'water_proximity_max_ft',
      met: (property.water_proximity_ft ?? Infinity) <= filters.water_proximity_max_ft,
    });
  }

  const total = breakdown.length;
  const score = breakdown.filter((b) => b.met).length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return { score, total, percentage, breakdown };
}
