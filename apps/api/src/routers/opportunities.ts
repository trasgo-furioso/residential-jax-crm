import { z } from 'zod';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { router, publicProcedure } from './trpc.js';
import { db } from '@/lib/db/index.js';
import {
  opportunities,
  opportunityHistory,
  tasks,
  outreachRecords,
} from '@/lib/db/schema.js';
import { queryProperties } from '@/services/duckdb.js';

const VALID_STAGES = [
  'identified',
  'contacted',
  'negotiating',
  'under_contract',
  'closed',
  'dead',
] as const;

// ── Tasks sub-router (T040) ────────────────────────────────────────────────

const tasksRouter = router({
  list: publicProcedure
    .input(z.object({ opportunity_id: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.opportunity_id, input.opportunity_id))
        .orderBy(desc(tasks.created_at));
      return rows;
    }),

  create: publicProcedure
    .input(
      z.object({
        opportunity_id: z.string().uuid(),
        title: z.string().min(1),
        assignee: z.string().optional(),
        due_date: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const rows = await db
        .insert(tasks)
        .values({
          opportunity_id: input.opportunity_id,
          title: input.title,
          assignee: input.assignee ?? null,
          due_date: input.due_date ?? null,
        })
        .returning();
      return rows[0];
    }),

  toggle: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // Fetch current state
      const current = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.id));
      if (!current[0]) throw new Error('Task not found');

      const rows = await db
        .update(tasks)
        .set({ completed: !current[0].completed })
        .where(eq(tasks.id, input.id))
        .returning();
      return rows[0];
    }),
});

// ── Opportunities router (T039) ────────────────────────────────────────────

export const opportunitiesRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          stage: z.string().optional(),
          zip: z.string().optional(),
          min_score: z.number().optional(),
          date_from: z.string().optional(),
          date_to: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const conditions = [];

      if (input?.stage) {
        conditions.push(eq(opportunities.stage, input.stage));
      }
      if (input?.min_score !== undefined) {
        conditions.push(
          gte(opportunities.criteria_match_score, String(input.min_score)),
        );
      }
      if (input?.date_from) {
        conditions.push(
          gte(opportunities.created_at, new Date(input.date_from)),
        );
      }
      if (input?.date_to) {
        conditions.push(
          lte(opportunities.created_at, new Date(input.date_to)),
        );
      }

      let rows;
      if (conditions.length > 0) {
        rows = await db
          .select()
          .from(opportunities)
          .where(and(...conditions))
          .orderBy(desc(opportunities.updated_at));
      } else {
        rows = await db
          .select()
          .from(opportunities)
          .orderBy(desc(opportunities.updated_at));
      }

      // If zip filter is specified, we need to filter by parcel_id lookup
      // since zip is on the DuckDB side, not in Postgres
      if (input?.zip) {
        const props = await queryProperties();
        const parcelIdsInZip = new Set(
          props
            .filter((p) => p.address_zip === input.zip)
            .map((p) => p.parcel_id),
        );
        rows = rows.filter((r) => parcelIdsInZip.has(r.parcel_id));
      }

      return rows;
    }),

  create: publicProcedure
    .input(
      z.object({
        parcel_id: z.string(),
        source_criteria_id: z.string().uuid().optional(),
        criteria_match_score: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Check if opportunity already exists for this parcel
      const existing = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.parcel_id, input.parcel_id));

      if (existing[0]) {
        return { exists: true as const, opportunity: existing[0] };
      }

      // Look up owner_name from DuckDB
      const props = await queryProperties();
      const property = props.find((p) => p.parcel_id === input.parcel_id);
      const ownerName = property?.current_owner_name ?? null;
      const address = property
        ? `${property.address_street ?? ''}, ${property.address_city ?? ''} ${property.address_zip ?? ''}`.replace(/^,\s*/, '').trim()
        : null;

      // Insert new opportunity
      const created = await db
        .insert(opportunities)
        .values({
          parcel_id: input.parcel_id,
          address,
          stage: 'identified',
          owner_name: ownerName,
          criteria_match_score: input.criteria_match_score
            ? String(input.criteria_match_score)
            : null,
          source_criteria_id: input.source_criteria_id ?? null,
        })
        .returning();

      const opp = created[0];

      // Insert initial history record
      await db.insert(opportunityHistory).values({
        opportunity_id: opp.id,
        from_stage: null,
        to_stage: 'identified',
        note: 'Opportunity created',
      });

      return { exists: false as const, opportunity: opp };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const oppRows = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, input.id));

      const opp = oppRows[0];
      if (!opp) return null;

      const [history, taskRows, outreach] = await Promise.all([
        db
          .select()
          .from(opportunityHistory)
          .where(eq(opportunityHistory.opportunity_id, input.id))
          .orderBy(desc(opportunityHistory.created_at)),
        db
          .select()
          .from(tasks)
          .where(eq(tasks.opportunity_id, input.id))
          .orderBy(desc(tasks.created_at)),
        db
          .select()
          .from(outreachRecords)
          .where(eq(outreachRecords.opportunity_id, input.id))
          .orderBy(desc(outreachRecords.sent_at)),
      ]);

      return {
        ...opp,
        history,
        tasks: taskRows,
        outreach,
      };
    }),

  updateStage: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        stage: z.enum(VALID_STAGES),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Get current stage
      const current = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, input.id));

      if (!current[0]) throw new Error('Opportunity not found');

      const fromStage = current[0].stage;

      // Update opportunity stage
      const updated = await db
        .update(opportunities)
        .set({
          stage: input.stage,
          updated_at: new Date(),
        })
        .where(eq(opportunities.id, input.id))
        .returning();

      // Insert history record
      await db.insert(opportunityHistory).values({
        opportunity_id: input.id,
        from_stage: fromStage,
        to_stage: input.stage,
        note: input.note ?? null,
      });

      return updated[0];
    }),

  updateDetails: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        owner_contact_email: z.string().optional(),
        owner_contact_phone: z.string().optional(),
        owner_interest: z.string().optional(),
        asking_price: z.number().optional(),
        offer_amount: z.number().optional(),
        notes: z.string().optional(),
        next_steps: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      const values: Record<string, unknown> = {};

      if (fields.owner_contact_email !== undefined)
        values.owner_contact_email = fields.owner_contact_email;
      if (fields.owner_contact_phone !== undefined)
        values.owner_contact_phone = fields.owner_contact_phone;
      if (fields.owner_interest !== undefined)
        values.owner_interest = fields.owner_interest;
      if (fields.asking_price !== undefined)
        values.asking_price = String(fields.asking_price);
      if (fields.offer_amount !== undefined)
        values.offer_amount = String(fields.offer_amount);
      if (fields.notes !== undefined) values.notes = fields.notes;
      if (fields.next_steps !== undefined) values.next_steps = fields.next_steps;

      values.updated_at = new Date();

      const rows = await db
        .update(opportunities)
        .set(values)
        .where(eq(opportunities.id, id))
        .returning();

      return rows[0] ?? null;
    }),

  // Nested tasks sub-router (T040)
  tasks: tasksRouter,
});
