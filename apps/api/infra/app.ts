#!/usr/bin/env node
import 'source-map-support/register.js';
import { App } from 'aws-cdk-lib';
import { ResidentialCrmStack } from './stack.js';

const app = new App();

new ResidentialCrmStack(app, 'ResidentialCrmStack', {
  env: {
    region: 'us-east-2',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  frontendUrl: process.env.FRONTEND_URL,
});

app.synth();
