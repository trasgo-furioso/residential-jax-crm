import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { router, publicProcedure } from './trpc.js';
import { db } from '@/lib/db/index.js';
import { outreachRecords } from '@/lib/db/schema.js';

const CHANNEL_VALUES = ['email', 'sms', 'direct_mail'] as const;

/**
 * Simulate outreach status lifecycle based on elapsed time since sent_at.
 * - sent -> delivered after 30s
 * - delivered -> replied (70%) or bounced (30%) after 2min total
 * Uses a deterministic seed from the record id to decide replied vs bounced.
 */
function simulateStatus(
  record: {
    id: string;
    status: string;
    sent_at: Date | null;
  },
): { status: string; status_updated_at: Date | null } {
  if (!record.sent_at) {
    return { status: record.status, status_updated_at: null };
  }

  const now = Date.now();
  const sentMs = record.sent_at.getTime();
  const elapsed = now - sentMs;

  // Already in a terminal state
  if (record.status === 'replied' || record.status === 'bounced') {
    return { status: record.status, status_updated_at: null };
  }

  // Deterministic chance based on last 2 hex chars of uuid
  const hexTail = record.id.replace(/-/g, '').slice(-2);
  const seedValue = parseInt(hexTail, 16); // 0-255
  const willReply = seedValue / 255 < 0.7;

  if (elapsed >= 120_000) {
    // 2 minutes: advance to replied or bounced
    const finalStatus = willReply ? 'replied' : 'bounced';
    return {
      status: finalStatus,
      status_updated_at: new Date(sentMs + 120_000),
    };
  }

  if (elapsed >= 30_000) {
    // 30 seconds: advance to delivered
    return {
      status: 'delivered',
      status_updated_at: new Date(sentMs + 30_000),
    };
  }

  // Still in sent
  return { status: 'sent', status_updated_at: null };
}

export const outreachRouter = router({
  list: publicProcedure
    .input(z.object({ opportunity_id: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(outreachRecords)
        .where(eq(outreachRecords.opportunity_id, input.opportunity_id))
        .orderBy(desc(outreachRecords.sent_at));

      // Simulate lifecycle and persist status changes
      const results = [];
      for (const row of rows) {
        const sim = simulateStatus(row);
        if (sim.status !== row.status) {
          // Persist the simulated status advancement
          await db
            .update(outreachRecords)
            .set({
              status: sim.status,
              status_updated_at: sim.status_updated_at,
            })
            .where(eq(outreachRecords.id, row.id));
          results.push({
            ...row,
            status: sim.status,
            status_updated_at: sim.status_updated_at,
          });
        } else {
          results.push(row);
        }
      }

      return results;
    }),

  create: publicProcedure
    .input(
      z.object({
        opportunity_id: z.string().uuid(),
        channel: z.enum(CHANNEL_VALUES),
        recipient: z.string().min(1),
        subject: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const rows = await db
        .insert(outreachRecords)
        .values({
          opportunity_id: input.opportunity_id,
          channel: input.channel,
          recipient: input.recipient,
          subject: input.subject ?? null,
          status: 'sent',
        })
        .returning();
      return rows[0];
    }),
});
