import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';
import {
  pipelineEvents,
  savedCriteria,
  notifications,
} from '@/lib/db/schema.js';
import {
  queryPropertiesByCriteria,
  type PropertyFilters,
} from '@/services/duckdb.js';
import type { WebhookEvent } from '@crm/shared';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { Metrics } from '@aws-lambda-powertools/metrics';

// ── Signature verification ──────────────────────────────────────────────────

export function verifySignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex'),
  );
}

// ── Duplicate detection ─────────────────────────────────────────────────────

export async function isDuplicate(eventId: string): Promise<boolean> {
  const rows = await db
    .select({ event_id: pipelineEvents.event_id })
    .from(pipelineEvents)
    .where(eq(pipelineEvents.event_id, eventId));
  return rows.length > 0;
}

// ── Criteria-filter mapping ─────────────────────────────────────────────────

interface StoredFilters {
  ownership_tenure_min_years?: number;
  roof_age_min_years?: number;
  zip_codes?: string[];
  assessed_value_min?: number;
  assessed_value_max?: number;
  is_regional_owner?: boolean;
  water_proximity_max_ft?: number;
}

function toPropertyFilters(f: StoredFilters): PropertyFilters {
  const pf: PropertyFilters = {};
  if (f.assessed_value_min !== undefined) pf.min_assessed_value = f.assessed_value_min;
  if (f.assessed_value_max !== undefined) pf.max_assessed_value = f.assessed_value_max;
  if (f.ownership_tenure_min_years !== undefined)
    pf.min_ownership_tenure_years = f.ownership_tenure_min_years;
  if (f.roof_age_min_years !== undefined) pf.min_roof_age_years = f.roof_age_min_years;
  if (f.is_regional_owner !== undefined) pf.is_regional_owner = f.is_regional_owner;
  if (f.water_proximity_max_ft !== undefined)
    pf.max_water_proximity_ft = f.water_proximity_max_ft;
  return pf;
}

// ── Main processing ─────────────────────────────────────────────────────────

export async function processWebhookEvent(
  event: WebhookEvent,
  logger?: Logger,
  metrics?: Metrics,
): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Insert pipeline event with status 'processing'
    logger?.info('Inserting pipeline event', { event_id: event.event_id });
    await db.insert(pipelineEvents).values({
      event_id: event.event_id,
      run_id: event.run_id,
      county: event.county,
      ipns_pointer: event.ipns_pointer,
      artifact_cid: event.artifact_cid,
      delta_new: event.delta.new_count,
      delta_updated: event.delta.updated_count,
      delta_removed: event.delta.removed_count,
      delta_parcel_ids: {
        new: event.delta.new_parcel_ids,
        updated: event.delta.updated_parcel_ids,
        removed: event.delta.removed_parcel_ids,
      },
      status: 'processing',
    });

    // 2. Get all saved criteria with notifications enabled
    const allCriteria = await db
      .select()
      .from(savedCriteria)
      .where(eq(savedCriteria.notifications_enabled, true));

    logger?.info('Evaluating criteria', { criteria_count: allCriteria.length });

    // Parcel IDs from delta that could match
    const deltaParcelIds = [
      ...event.delta.new_parcel_ids,
      ...event.delta.updated_parcel_ids,
    ];

    if (deltaParcelIds.length === 0) {
      logger?.info('No new or updated parcels in delta, skipping criteria matching');
      await db
        .update(pipelineEvents)
        .set({ status: 'completed', processed_at: new Date() })
        .where(eq(pipelineEvents.event_id, event.event_id));
      metrics?.addMetric('WebhookProcessed', 'Count', 1);
      metrics?.addMetric('ProcessingDuration', 'Milliseconds', Date.now() - startTime);
      return;
    }

    // 3. For each criteria, query DuckDB for matching properties from delta
    let notificationsGenerated = 0;
    let criteriaMatched = 0;

    for (const criteria of allCriteria) {
      const filters = criteria.filters as StoredFilters;
      const propertyFilters = toPropertyFilters(filters);

      // Query all properties matching the criteria filters
      let matchingRows;

      // Handle zip_codes array
      const zipCodes = filters.zip_codes;
      if (zipCodes && zipCodes.length > 0) {
        const results = await Promise.all(
          zipCodes.map((zip) =>
            queryPropertiesByCriteria({ ...propertyFilters, zip }),
          ),
        );
        const seen = new Set<string>();
        matchingRows = results.flat().filter((r) => {
          if (seen.has(r.parcel_id)) return false;
          seen.add(r.parcel_id);
          return true;
        });
      } else {
        matchingRows = await queryPropertiesByCriteria(propertyFilters);
      }

      // Filter to only delta parcel IDs
      const deltaSet = new Set(deltaParcelIds);
      const matchedParcels = matchingRows
        .filter((row) => deltaSet.has(row.parcel_id))
        .map((row) => row.parcel_id);

      if (matchedParcels.length === 0) {
        logger?.debug('No matches for criteria', { criteria_id: criteria.id });
        continue;
      }

      criteriaMatched++;

      // 4. Create ONE summary notification per criteria
      const newCount = matchedParcels.filter((id) =>
        event.delta.new_parcel_ids.includes(id),
      ).length;
      const updatedCount = matchedParcels.filter((id) =>
        event.delta.updated_parcel_ids.includes(id),
      ).length;

      const parts: string[] = [];
      if (newCount > 0) parts.push(`${newCount} new`);
      if (updatedCount > 0) parts.push(`${updatedCount} updated`);
      const summary = `${parts.join(', ')} match${matchedParcels.length === 1 ? '' : 'es'} for '${criteria.name}'`;

      await db.insert(notifications).values({
        criteria_id: criteria.id,
        event_id: event.event_id,
        run_id: event.run_id,
        matched_count: matchedParcels.length,
        matched_parcel_ids: matchedParcels,
        summary,
        read: false,
      });

      notificationsGenerated++;
      logger?.info('Notification created', {
        criteria_id: criteria.id,
        matched_count: matchedParcels.length,
        summary,
      });
    }

    // 6. Update pipeline event status to completed
    await db
      .update(pipelineEvents)
      .set({ status: 'completed', processed_at: new Date() })
      .where(eq(pipelineEvents.event_id, event.event_id));

    // Emit metrics
    metrics?.addMetric('WebhookProcessed', 'Count', 1);
    metrics?.addMetric('NotificationGenerated', 'Count', notificationsGenerated);
    metrics?.addMetric('CriteriaMatched', 'Count', criteriaMatched);
    metrics?.addMetric('ProcessingDuration', 'Milliseconds', Date.now() - startTime);

    logger?.info('Webhook processing completed', {
      event_id: event.event_id,
      notifications_generated: notificationsGenerated,
      criteria_matched: criteriaMatched,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    // Mark event as failed
    try {
      await db
        .update(pipelineEvents)
        .set({ status: 'failed', processed_at: new Date() })
        .where(eq(pipelineEvents.event_id, event.event_id));
    } catch {
      logger?.error('Failed to update pipeline event status to failed');
    }

    metrics?.addMetric('WebhookFailed', 'Count', 1);
    metrics?.addMetric('ProcessingDuration', 'Milliseconds', Date.now() - startTime);

    logger?.error('Webhook processing failed', {
      event_id: event.event_id,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
