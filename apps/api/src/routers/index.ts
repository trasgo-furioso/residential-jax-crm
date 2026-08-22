import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { Context } from '@/context.js';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Placeholder sub-routers — real implementations arrive in Phase 3+.
 */
const healthRouter = router({
  ping: publicProcedure.query(() => ({ status: 'ok', timestamp: new Date().toISOString() })),
});

export const appRouter = router({
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
