import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { awsLambdaRequestHandler } from '@trpc/server/adapters/aws-lambda';
import { appRouter } from '@/routers/index.js';
import { createContext } from '@/context.js';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const logger = new Logger({ serviceName: 'crm-api' });
const tracer = new Tracer({ serviceName: 'crm-api' });
const metrics = new Metrics({ serviceName: 'crm-api', namespace: 'CRM' });

logger.info('Initializing tRPC Lambda handler');

const trpcHandler = awsLambdaRequestHandler({
  router: appRouter,
  createContext,
});

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: unknown,
): Promise<APIGatewayProxyResultV2> => {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Webhook-Signature',
        'Access-Control-Max-Age': '3600',
      },
      body: '',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return trpcHandler(event, context as any) as Promise<APIGatewayProxyResultV2>;
};
