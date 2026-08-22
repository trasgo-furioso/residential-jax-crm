import {
  Stack,
  StackProps,
  Duration,
  Tags,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ResidentialCrmStackProps extends StackProps {
  /** Amplify frontend URL for CORS allow-origin */
  frontendUrl?: string;
  /** Custom domain name (optional) */
  customDomainName?: string;
}

export class ResidentialCrmStack extends Stack {
  public readonly apiUrl: CfnOutput;

  constructor(scope: Construct, id: string, props?: ResidentialCrmStackProps) {
    super(scope, id, {
      ...props,
      env: {
        region: 'us-east-2',
        ...props?.env,
      },
    });

    // ── Lambda Function ──────────────────────────────────────────────────
    const fn = new NodejsFunction(this, 'CrmApiHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'src', 'handler.ts'),
      memorySize: 512,
      timeout: Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'ResidentialCRM',
        POWERTOOLS_METRICS_NAMESPACE: 'ResidentialCRM',
        NODE_OPTIONS: '--enable-source-maps',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? '',
        IPNS_OPEN_DATA_KEY: process.env.IPNS_OPEN_DATA_KEY ?? '',
        IPNS_QUERY_TABLE_KEY: process.env.IPNS_QUERY_TABLE_KEY ?? '',
        BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
        PAGERDUTY_ROUTING_KEY_SECRET_ARN:
          process.env.PAGERDUTY_ROUTING_KEY_SECRET_ARN ?? '',
      },
      bundling: {
        externalModules: ['duckdb'],
        sourceMap: true,
        minify: true,
        target: 'node22',
      },
    });

    // ── HTTP API Gateway v2 ──────────────────────────────────────────────
    const integration = new HttpLambdaIntegration('CrmLambdaIntegration', fn);

    const allowOrigins = props?.frontendUrl
      ? [props.frontendUrl]
      : ['https://*.amplifyapp.com'];

    const httpApi = new apigwv2.HttpApi(this, 'CrmHttpApi', {
      apiName: 'residential-crm-api',
      description: 'Residential JAX CRM API',
      corsPreflight: {
        allowOrigins,
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Webhook-Signature',
        ],
        maxAge: Duration.hours(1),
      },
      defaultIntegration: integration,
    });

    // ── Tags ─────────────────────────────────────────────────────────────
    Tags.of(this).add('project_name', 'residential-jax-crm');

    // ── Outputs ──────────────────────────────────────────────────────────
    this.apiUrl = new CfnOutput(this, 'ApiUrl', {
      value: httpApi.url ?? '',
      description: 'HTTP API Gateway URL',
    });
  }
}
