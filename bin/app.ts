#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NodejsFargateStack } from '../lib/nodejs-fargate-stack';

const app = new cdk.App();

// Development environment stack
new NodejsFargateStack(app, 'NodejsFargateDevStack', {
  appName: 'nodejs-fargate-app',
  environment: 'dev',
  containerPort: 3000,
  desiredCount: 2,
  cpu: 256,
  memory: 512,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-2',
  },
});