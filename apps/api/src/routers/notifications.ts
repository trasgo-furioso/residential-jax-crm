import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { router, publicProcedure } from './trpc.js';
import { db } from '@/lib/db/index.js';
import { notifications } from '@/lib/db/schema.js';

export const notificationsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    ctx.logger.info('Listing notifications');

    const rows = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.created_at));

    const unreadCount = rows.filter((r) => r.read === false).length;

    return { notifications: rows, unread_count: unreadCount };
  }),

  markAsRead: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      ctx.logger.info('Marking notification as read', { id: input.id });

      const rows = await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, input.id))
        .returning();

      return rows[0] ?? null;
    }),

  markAllRead: publicProcedure.mutation(async ({ ctx }) => {
    ctx.logger.info('Marking all notifications as read');

    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.read, false));

    return { success: true };
  }),
});
