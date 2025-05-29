#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const nodejs_fargate_stack_1 = require("../lib/nodejs-fargate-stack");
const app = new cdk.App();
// Development environment stack
new nodejs_fargate_stack_1.NodejsFargateStack(app, 'NodejsFargateDevStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyxzRUFBaUU7QUFFakUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsZ0NBQWdDO0FBQ2hDLElBQUkseUNBQWtCLENBQUMsR0FBRyxFQUFFLHVCQUF1QixFQUFFO0lBQ25ELE9BQU8sRUFBRSxvQkFBb0I7SUFDN0IsV0FBVyxFQUFFLEtBQUs7SUFDbEIsYUFBYSxFQUFFLElBQUk7SUFDbkIsWUFBWSxFQUFFLENBQUM7SUFDZixHQUFHLEVBQUUsR0FBRztJQUNSLE1BQU0sRUFBRSxHQUFHO0lBQ1gsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXHJcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcclxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgTm9kZWpzRmFyZ2F0ZVN0YWNrIH0gZnJvbSAnLi4vbGliL25vZGVqcy1mYXJnYXRlLXN0YWNrJztcclxuXHJcbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XHJcblxyXG4vLyBEZXZlbG9wbWVudCBlbnZpcm9ubWVudCBzdGFja1xyXG5uZXcgTm9kZWpzRmFyZ2F0ZVN0YWNrKGFwcCwgJ05vZGVqc0ZhcmdhdGVEZXZTdGFjaycsIHtcclxuICBhcHBOYW1lOiAnbm9kZWpzLWZhcmdhdGUtYXBwJyxcclxuICBlbnZpcm9ubWVudDogJ2RldicsXHJcbiAgY29udGFpbmVyUG9ydDogMzAwMCxcclxuICBkZXNpcmVkQ291bnQ6IDIsXHJcbiAgY3B1OiAyNTYsXHJcbiAgbWVtb3J5OiA1MTIsXHJcbiAgZW52OiB7XHJcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ2V1LXdlc3QtMicsXHJcbiAgfSxcclxufSk7Il19