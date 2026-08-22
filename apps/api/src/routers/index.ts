import { router, publicProcedure } from './trpc.js';
import { propertiesRouter } from './properties.js';

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
});

export type AppRouter = typeof appRouter;
