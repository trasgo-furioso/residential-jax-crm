import { router, publicProcedure } from './trpc.js';
import { propertiesRouter } from './properties.js';
import { criteriaRouter } from './criteria.js';
import { opportunitiesRouter } from './opportunities.js';
import { webhookRouter } from './webhook.js';
import { notificationsRouter } from './notifications.js';
import { outreachRouter } from './outreach.js';
import { exportRouter } from './export.js';

export { router, publicProcedure } from './trpc.js';

/**
 * Sub-routers
 */
const healthRouter = router({
  ping: publicProcedure.query(() => ({ status: 'ok', timestamp: new Date().toISOString() })),
});

export const appRouter = router({
  health: healthRouter,
  properties: propertiesRouter,
  criteria: criteriaRouter,
  opportunities: opportunitiesRouter,
  webhook: webhookRouter,
  notifications: notificationsRouter,
  outreach: outreachRouter,
  export: exportRouter,
});

export type AppRouter = typeof appRouter;
