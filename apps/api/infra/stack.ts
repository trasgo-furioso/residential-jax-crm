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
import { createDashboard } from './dashboard.js';

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

    // ── DuckDB Lambda Layer (pre-built Linux x86_64 native module) ──────
    // Source: https://github.com/tobilg/duckdb-nodejs-layer
    // Layer version 21 = DuckDB v1.4.1 with parquet, httpfs, json, icu
    const duckdbLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'DuckDBLayer',
      'arn:aws:lambda:us-east-2:041475135427:layer:duckdb-nodejs-x86:21',
    );

    // ── Lambda Function ──────────────────────────────────────────────────
    const fn = new NodejsFunction(this, 'CrmApiHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'src', 'handler.ts'),
      memorySize: 1024,
      timeout: Duration.seconds(60),
      tracing: lambda.Tracing.ACTIVE,
      layers: [duckdbLayer],
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
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
        PIPELINE_API_URL:
          process.env.PIPELINE_API_URL ??
          'https://d5sfa8vgu8mcx.cloudfront.net',
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

    // ── Webhook Lambda Function ─────────────────────────────────────────
    const webhookFn = new NodejsFunction(this, 'CrmWebhookHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '..', 'src', 'webhook-handler-raw.ts'),
      memorySize: 1024,
      timeout: Duration.seconds(60),
      tracing: lambda.Tracing.ACTIVE,
      layers: [duckdbLayer],
      environment: {
        POWERTOOLS_SERVICE_NAME: 'ResidentialCRM',
        POWERTOOLS_METRICS_NAMESPACE: 'ResidentialCRM',
        NODE_OPTIONS: '--enable-source-maps',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? '',
        IPNS_OPEN_DATA_KEY: process.env.IPNS_OPEN_DATA_KEY ?? '',
        IPNS_QUERY_TABLE_KEY: process.env.IPNS_QUERY_TABLE_KEY ?? '',
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
    const webhookIntegration = new HttpLambdaIntegration('CrmWebhookIntegration', webhookFn);

    const allowOrigins = props?.frontendUrl
      ? [props.frontendUrl]
      : ['*'];

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

    // Explicit route for raw pipeline webhook
    httpApi.addRoutes({
      path: '/webhook/pipeline',
      methods: [apigwv2.HttpMethod.POST],
      integration: webhookIntegration,
    });

    // ── Tags ─────────────────────────────────────────────────────────────
    Tags.of(this).add('project_name', 'residential-jax-crm');

    // ── Outputs ──────────────────────────────────────────────────────────
    this.apiUrl = new CfnOutput(this, 'ApiUrl', {
      value: httpApi.url ?? '',
      description: 'HTTP API Gateway URL',
    });

    // ── CloudWatch Dashboard ────────────────────────────────────────────
    createDashboard(this, 'CrmDashboard');
  }
}
