import { z } from 'zod';
import { router, publicProcedure } from './trpc.js';
import { queryProperties } from '@/services/duckdb.js';
import { db } from '@/lib/db/index.js';
import { opportunities } from '@/lib/db/schema.js';
import { inArray } from 'drizzle-orm';

/**
 * Escape a value for CSV: wrap in double-quotes if it contains a comma,
 * double-quote, or newline. Internal double-quotes are doubled.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => csvEscape(row[h])).join(','),
  );
  return [headerLine, ...dataLines].join('\n');
}

export const exportRouter = router({
  /**
   * Export properties by parcel IDs from DuckDB → CSV string.
   */
  exportProperties: publicProcedure
    .input(z.object({ parcel_ids: z.array(z.string()).min(1) }))
    .mutation(async ({ input }) => {
      const allProperties = await queryProperties();
      const idSet = new Set(input.parcel_ids);
      const filtered = allProperties.filter((p) => idSet.has(p.parcel_id));
      const csv = toCsv(filtered as unknown as Record<string, unknown>[]);
      const timestamp = new Date().toISOString().slice(0, 10);
      return {
        csv,
        filename: `properties-export-${timestamp}.csv`,
      };
    }),

  /**
   * Export opportunities by IDs from Drizzle/Postgres → CSV string.
   */
  exportOpportunities: publicProcedure
    .input(z.object({ opportunity_ids: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ input }) => {
      const rows = await db
        .select()
        .from(opportunities)
        .where(inArray(opportunities.id, input.opportunity_ids));
      const csv = toCsv(rows as unknown as Record<string, unknown>[]);
      const timestamp = new Date().toISOString().slice(0, 10);
      return {
        csv,
        filename: `opportunities-export-${timestamp}.csv`,
      };
    }),
});
