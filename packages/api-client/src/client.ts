import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';

/**
 * API client configuration for the CRM tRPC backend.
 *
 * Phase 2 will define the actual AppRouter type in apps/api and wire it here.
 * For now, we export factory helpers and the raw createTRPCReact / httpBatchLink
 * so consuming code can instantiate once the router type exists.
 */

export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });
}

export { createTRPCReact, httpBatchLink, QueryClient };
