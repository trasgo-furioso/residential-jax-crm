import { z } from 'zod';
import { router, publicProcedure } from './trpc.js';
import { queryProperties, queryPropertiesByCriteria } from '@/services/duckdb.js';
import type { PropertyFilters } from '@/services/duckdb.js';

const searchInputSchema = z.object({
  ownership_tenure_min_years: z.number().optional(),
  roof_age_min_years: z.number().optional(),
  zip_codes: z.array(z.string()).optional(),
  assessed_value_min: z.number().optional(),
  assessed_value_max: z.number().optional(),
  is_regional_owner: z.boolean().optional(),
  water_proximity_max_ft: z.number().optional(),
});

export const propertiesRouter = router({
  list: publicProcedure.query(async () => {
    const rows = await queryProperties();
    return rows;
  }),

  getById: publicProcedure
    .input(z.object({ parcel_id: z.string() }))
    .query(async ({ input }) => {
      const allRows = await queryProperties();
      const match = allRows.find((r) => r.parcel_id === input.parcel_id);
      return match ?? null;
    }),

  search: publicProcedure
    .input(searchInputSchema)
    .query(async ({ input }) => {
      const filters: PropertyFilters = {};

      if (input.assessed_value_min !== undefined) {
        filters.min_assessed_value = input.assessed_value_min;
      }
      if (input.assessed_value_max !== undefined) {
        filters.max_assessed_value = input.assessed_value_max;
      }
      if (input.ownership_tenure_min_years !== undefined) {
        filters.min_ownership_tenure_years = input.ownership_tenure_min_years;
      }
      if (input.roof_age_min_years !== undefined) {
        filters.min_roof_age_years = input.roof_age_min_years;
      }
      if (input.is_regional_owner !== undefined) {
        filters.is_regional_owner = input.is_regional_owner;
      }
      if (input.water_proximity_max_ft !== undefined) {
        filters.max_water_proximity_ft = input.water_proximity_max_ft;
      }

      // Handle zip_codes array — query each and merge results
      if (input.zip_codes && input.zip_codes.length > 0) {
        const results = await Promise.all(
          input.zip_codes.map((zip) =>
            queryPropertiesByCriteria({ ...filters, zip }),
          ),
        );
        // Deduplicate by parcel_id
        const seen = new Set<string>();
        const merged = results.flat().filter((r) => {
          if (seen.has(r.parcel_id)) return false;
          seen.add(r.parcel_id);
          return true;
        });
        return merged;
      }

      const rows = await queryPropertiesByCriteria(filters);
      return rows;
    }),
});
