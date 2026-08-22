import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { awsLambdaRequestHandler } from '@trpc/server/adapters/aws-lambda';
import { appRouter } from '@/routers/index.js';
import { createContext } from '@/context.js';

const logger = new Logger({ serviceName: 'crm-api' });
const tracer = new Tracer({ serviceName: 'crm-api' });
const metrics = new Metrics({ serviceName: 'crm-api', namespace: 'CRM' });

logger.info('Initializing tRPC Lambda handler');

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext,
});
