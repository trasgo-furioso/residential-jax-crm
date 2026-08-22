import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { router, publicProcedure } from './trpc.js';
import { db } from '@/lib/db/index.js';
import { savedCriteria } from '@/lib/db/schema.js';

const filtersSchema = z.object({
  ownership_tenure_min_years: z.number().optional(),
  roof_age_min_years: z.number().optional(),
  zip_codes: z.array(z.string()).optional(),
  assessed_value_min: z.number().optional(),
  assessed_value_max: z.number().optional(),
  is_regional_owner: z.boolean().optional(),
  water_proximity_max_ft: z.number().optional(),
});

const geographicBoundsSchema = z
  .object({
    north: z.number(),
    south: z.number(),
    east: z.number(),
    west: z.number(),
  })
  .nullable()
  .optional();

export const criteriaRouter = router({
  list: publicProcedure.query(async () => {
    const rows = await db.select().from(savedCriteria);
    return rows;
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(savedCriteria)
        .where(eq(savedCriteria.id, input.id));
      return rows[0] ?? null;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        filters: filtersSchema,
        geographic_bounds: geographicBoundsSchema,
        notifications_enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const rows = await db
        .insert(savedCriteria)
        .values({
          name: input.name,
          filters: input.filters,
          geographic_bounds: input.geographic_bounds ?? null,
          notifications_enabled: input.notifications_enabled ?? true,
        })
        .returning();
      return rows[0];
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        filters: filtersSchema.optional(),
        geographic_bounds: geographicBoundsSchema,
        notifications_enabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const values: Record<string, unknown> = {};

      if (updates.name !== undefined) values.name = updates.name;
      if (updates.filters !== undefined) values.filters = updates.filters;
      if (updates.geographic_bounds !== undefined)
        values.geographic_bounds = updates.geographic_bounds;
      if (updates.notifications_enabled !== undefined)
        values.notifications_enabled = updates.notifications_enabled;

      values.updated_at = new Date();

      const rows = await db
        .update(savedCriteria)
        .set(values)
        .where(eq(savedCriteria.id, id))
        .returning();
      return rows[0] ?? null;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(savedCriteria).where(eq(savedCriteria.id, input.id));
      return { success: true };
    }),
});
