import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';
import type { CreateAWSLambdaContextOptions } from '@trpc/server/adapters/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const logger = new Logger({ serviceName: 'crm-api' });
const tracer = new Tracer({ serviceName: 'crm-api' });
const metrics = new Metrics({ serviceName: 'crm-api', namespace: 'CRM' });

export function createContext({
  event,
  context,
}: CreateAWSLambdaContextOptions<APIGatewayProxyEventV2>) {
  return {
    logger,
    tracer,
    metrics,
    event,
    lambdaContext: context,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
