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
exports.NodejsFargateStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ecsPatterns = __importStar(require("aws-cdk-lib/aws-ecs-patterns"));
class NodejsFargateStack extends cdk.Stack {
    constructor(scope, id, props = {}) {
        super(scope, id, props);
        // Configuration with defaults
        const appName = props.appName || 'nodejs-fargate-app';
        const environment = props.environment || 'dev';
        const containerPort = props.containerPort || 3000;
        const desiredCount = props.desiredCount || 1; // Reduced default for lightweight
        const cpu = props.cpu || 256;
        const memory = props.memory || 512;
        // Create VPC with public and private subnets across 2 AZs
        // (ALB requires at least 2 AZs, but we can still save costs with 1 NAT gateway)
        const vpc = new ec2.Vpc(this, 'Vpc', {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
        });
        // Create ECS Cluster
        const cluster = new ecs.Cluster(this, 'Cluster', {
            vpc,
            clusterName: `${appName}-cluster`,
            containerInsights: true,
        });
        // Create Fargate Service with Application Load Balancer
        // This pattern automatically creates ECR repo, builds image, ALB, target group, etc.
        const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
            cluster,
            serviceName: `${appName}-service`,
            taskImageOptions: {
                // CDK will automatically build the Docker image from the specified directory
                image: ecs.ContainerImage.fromAsset('./app', {
                    // Optional: specify platform for multi-arch builds
                    platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64,
                }),
                containerName: appName,
                containerPort: containerPort,
                environment: {
                    NODE_ENV: 'production',
                    PORT: containerPort.toString(),
                    AWS_REGION: this.region,
                    APP_VERSION: '1.0.0',
                },
            },
            memoryLimitMiB: memory,
            cpu: cpu,
            desiredCount: desiredCount,
            publicLoadBalancer: true,
            listenerPort: 80,
            // Deploy to private subnets for security
            assignPublicIp: false,
        });
        // Configure health check
        fargateService.targetGroup.configureHealthCheck({
            path: '/health',
            healthyHttpCodes: '200',
            interval: cdk.Duration.seconds(30),
            timeout: cdk.Duration.seconds(5),
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 2,
        });
        // Configure auto scaling (reduced capacity for lightweight)
        const scalableTarget = fargateService.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 5, // Reduced from 10 for lightweight
        });
        // Scale based on CPU utilization
        scalableTarget.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: 70,
            scaleInCooldown: cdk.Duration.seconds(300),
            scaleOutCooldown: cdk.Duration.seconds(300),
        });
        // Scale based on memory utilization
        scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
            targetUtilizationPercent: 80,
            scaleInCooldown: cdk.Duration.seconds(300),
            scaleOutCooldown: cdk.Duration.seconds(300),
        });
        // Store outputs
        this.loadBalancerDns = fargateService.loadBalancer.loadBalancerDnsName;
        this.ecrRepository = fargateService.taskDefinition.obtainExecutionRole().roleArn;
        // Add tags to all resources
        cdk.Tags.of(this).add('Environment', environment);
        cdk.Tags.of(this).add('Application', appName);
        // Outputs
        new cdk.CfnOutput(this, 'LoadBalancerDNS', {
            value: fargateService.loadBalancer.loadBalancerDnsName,
            description: 'DNS name of the load balancer',
        });
        new cdk.CfnOutput(this, 'LoadBalancerURL', {
            value: `http://${fargateService.loadBalancer.loadBalancerDnsName}`,
            description: 'URL of the application',
        });
        new cdk.CfnOutput(this, 'ClusterName', {
            value: cluster.clusterName,
            description: 'Name of the ECS cluster',
        });
        new cdk.CfnOutput(this, 'ServiceName', {
            value: fargateService.service.serviceName,
            description: 'Name of the ECS service',
        });
    }
}
exports.NodejsFargateStack = NodejsFargateStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzLWZhcmdhdGUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJub2RlanMtZmFyZ2F0ZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLDBFQUE0RDtBQVk1RCxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSS9DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsUUFBaUMsRUFBRTtRQUMzRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4QkFBOEI7UUFDOUIsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxvQkFBb0IsQ0FBQztRQUN0RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztRQUMvQyxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQztRQUNsRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxJQUFJLENBQUMsQ0FBQyxDQUFDLGtDQUFrQztRQUNoRixNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQztRQUM3QixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQztRQUVuQywwREFBMEQ7UUFDMUQsZ0ZBQWdGO1FBQ2hGLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO1lBQ25DLE1BQU0sRUFBRSxDQUFDO1lBQ1QsV0FBVyxFQUFFLENBQUM7WUFDZCxtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMs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YXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xyXG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XHJcbmltcG9ydCAqIGFzIGVjc1BhdHRlcm5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MtcGF0dGVybnMnO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuXHJcbmludGVyZmFjZSBOb2RlanNGYXJnYXRlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICBhcHBOYW1lPzogc3RyaW5nO1xyXG4gIGVudmlyb25tZW50Pzogc3RyaW5nO1xyXG4gIGNvbnRhaW5lclBvcnQ/OiBudW1iZXI7XHJcbiAgZGVzaXJlZENvdW50PzogbnVtYmVyO1xyXG4gIGNwdT86IG51bWJlcjtcclxuICBtZW1vcnk/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBOb2RlanNGYXJnYXRlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBsb2FkQmFsYW5jZXJEbnM6IHN0cmluZztcclxuICBwdWJsaWMgcmVhZG9ubHkgZWNyUmVwb3NpdG9yeTogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTm9kZWpzRmFyZ2F0ZVN0YWNrUHJvcHMgPSB7fSkge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJhdGlvbiB3aXRoIGRlZmF1bHRzXHJcbiAgICBjb25zdCBhcHBOYW1lID0gcHJvcHMuYXBwTmFtZSB8fCAnbm9kZWpzLWZhcmdhdGUtYXBwJztcclxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHMuZW52aXJvbm1lbnQgfHwgJ2Rldic7XHJcbiAgICBjb25zdCBjb250YWluZXJQb3J0ID0gcHJvcHMuY29udGFpbmVyUG9ydCB8fCAzMDAwO1xyXG4gICAgY29uc3QgZGVzaXJlZENvdW50ID0gcHJvcHMuZGVzaXJlZENvdW50IHx8IDE7IC8vIFJlZHVjZWQgZGVmYXVsdCBmb3IgbGlnaHR3ZWlnaHRcclxuICAgIGNvbnN0IGNwdSA9IHByb3BzLmNwdSB8fCAyNTY7XHJcbiAgICBjb25zdCBtZW1vcnkgPSBwcm9wcy5tZW1vcnkgfHwgNTEyO1xyXG5cclxuICAgIC8vIENyZWF0ZSBWUEMgd2l0aCBwdWJsaWMgYW5kIHByaXZhdGUgc3VibmV0cyBhY3Jvc3MgMiBBWnNcclxuICAgIC8vIChBTEIgcmVxdWlyZXMgYXQgbGVhc3QgMiBBWnMsIGJ1dCB3ZSBjYW4gc3RpbGwgc2F2ZSBjb3N0cyB3aXRoIDEgTkFUIGdhdGV3YXkpXHJcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnVnBjJywge1xyXG4gICAgICBtYXhBenM6IDIsIC8vIEFMQiByZXF1aXJlcyBtaW5pbXVtIDIgQVpzXHJcbiAgICAgIG5hdEdhdGV3YXlzOiAxLCAvLyBTaW5nbGUgTkFUIGdhdGV3YXkgc2hhcmVkIGFjcm9zcyBBWnNcclxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcclxuICAgICAgICAgIG5hbWU6ICdQdWJsaWMnLFxyXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxyXG4gICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxyXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcclxuICAgICAgICB9LFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIEVDUyBDbHVzdGVyXHJcbiAgICBjb25zdCBjbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdDbHVzdGVyJywge1xyXG4gICAgICB2cGMsXHJcbiAgICAgIGNsdXN0ZXJOYW1lOiBgJHthcHBOYW1lfS1jbHVzdGVyYCxcclxuICAgICAgY29udGFpbmVySW5zaWdodHM6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcblxyXG5cclxuICAgIC8vIENyZWF0ZSBGYXJnYXRlIFNlcnZpY2Ugd2l0aCBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyXHJcbiAgICAvLyBUaGlzIHBhdHRlcm4gYXV0b21hdGljYWxseSBjcmVhdGVzIEVDUiByZXBvLCBidWlsZHMgaW1hZ2UsIEFMQiwgdGFyZ2V0IGdyb3VwLCBldGMuXHJcbiAgICBjb25zdCBmYXJnYXRlU2VydmljZSA9IG5ldyBlY3NQYXR0ZXJucy5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlZEZhcmdhdGVTZXJ2aWNlKHRoaXMsICdGYXJnYXRlU2VydmljZScsIHtcclxuICAgICAgY2x1c3RlcixcclxuICAgICAgc2VydmljZU5hbWU6IGAke2FwcE5hbWV9LXNlcnZpY2VgLFxyXG4gICAgICB0YXNrSW1hZ2VPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gQ0RLIHdpbGwgYXV0b21hdGljYWxseSBidWlsZCB0aGUgRG9ja2VyIGltYWdlIGZyb20gdGhlIHNwZWNpZmllZCBkaXJlY3RvcnlcclxuICAgICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21Bc3NldCgnLi9hcHAnLCB7XHJcbiAgICAgICAgICAvLyBPcHRpb25hbDogc3BlY2lmeSBwbGF0Zm9ybSBmb3IgbXVsdGktYXJjaCBidWlsZHNcclxuICAgICAgICAgIHBsYXRmb3JtOiBjZGsuYXdzX2Vjcl9hc3NldHMuUGxhdGZvcm0uTElOVVhfQU1ENjQsXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgY29udGFpbmVyTmFtZTogYXBwTmFtZSxcclxuICAgICAgICBjb250YWluZXJQb3J0OiBjb250YWluZXJQb3J0LFxyXG4gICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxyXG4gICAgICAgICAgUE9SVDogY29udGFpbmVyUG9ydC50b1N0cmluZygpLFxyXG4gICAgICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXHJcbiAgICAgICAgICBBUFBfVkVSU0lPTjogJzEuMC4wJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICBtZW1vcnlMaW1pdE1pQjogbWVtb3J5LFxyXG4gICAgICBjcHU6IGNwdSxcclxuICAgICAgZGVzaXJlZENvdW50OiBkZXNpcmVkQ291bnQsXHJcbiAgICAgIHB1YmxpY0xvYWRCYWxhbmNlcjogdHJ1ZSxcclxuICAgICAgbGlzdGVuZXJQb3J0OiA4MCxcclxuICAgICAgLy8gRGVwbG95IHRvIHByaXZhdGUgc3VibmV0cyBmb3Igc2VjdXJpdHlcclxuICAgICAgYXNzaWduUHVibGljSXA6IGZhbHNlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJlIGhlYWx0aCBjaGVja1xyXG4gICAgZmFyZ2F0ZVNlcnZpY2UudGFyZ2V0R3JvdXAuY29uZmlndXJlSGVhbHRoQ2hlY2soe1xyXG4gICAgICBwYXRoOiAnL2hlYWx0aCcsXHJcbiAgICAgIGhlYWx0aHlIdHRwQ29kZXM6ICcyMDAnLFxyXG4gICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcclxuICAgICAgaGVhbHRoeVRocmVzaG9sZENvdW50OiAyLFxyXG4gICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbmZpZ3VyZSBhdXRvIHNjYWxpbmcgKHJlZHVjZWQgY2FwYWNpdHkgZm9yIGxpZ2h0d2VpZ2h0KVxyXG4gICAgY29uc3Qgc2NhbGFibGVUYXJnZXQgPSBmYXJnYXRlU2VydmljZS5zZXJ2aWNlLmF1dG9TY2FsZVRhc2tDb3VudCh7XHJcbiAgICAgIG1pbkNhcGFjaXR5OiAxLFxyXG4gICAgICBtYXhDYXBhY2l0eTogNSwgLy8gUmVkdWNlZCBmcm9tIDEwIGZvciBsaWdodHdlaWdodFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU2NhbGUgYmFzZWQgb24gQ1BVIHV0aWxpemF0aW9uXHJcbiAgICBzY2FsYWJsZVRhcmdldC5zY2FsZU9uQ3B1VXRpbGl6YXRpb24oJ0NwdVNjYWxpbmcnLCB7XHJcbiAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogNzAsXHJcbiAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSxcclxuICAgICAgc2NhbGVPdXRDb29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNjYWxlIGJhc2VkIG9uIG1lbW9yeSB1dGlsaXphdGlvblxyXG4gICAgc2NhbGFibGVUYXJnZXQuc2NhbGVPbk1lbW9yeVV0aWxpemF0aW9uKCdNZW1vcnlTY2FsaW5nJywge1xyXG4gICAgICB0YXJnZXRVdGlsaXphdGlvblBlcmNlbnQ6IDgwLFxyXG4gICAgICBzY2FsZUluQ29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXHJcbiAgICAgIHNjYWxlT3V0Q29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdG9yZSBvdXRwdXRzXHJcbiAgICB0aGlzLmxvYWRCYWxhbmNlckRucyA9IGZhcmdhdGVTZXJ2aWNlLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lO1xyXG4gICAgdGhpcy5lY3JSZXBvc2l0b3J5ID0gZmFyZ2F0ZVNlcnZpY2UudGFza0RlZmluaXRpb24ub2J0YWluRXhlY3V0aW9uUm9sZSgpLnJvbGVBcm47XHJcblxyXG4gICAgLy8gQWRkIHRhZ3MgdG8gYWxsIHJlc291cmNlc1xyXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KTtcclxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQXBwbGljYXRpb24nLCBhcHBOYW1lKTtcclxuXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9hZEJhbGFuY2VyRE5TJywge1xyXG4gICAgICB2YWx1ZTogZmFyZ2F0ZVNlcnZpY2UubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnRE5TIG5hbWUgb2YgdGhlIGxvYWQgYmFsYW5jZXInLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xvYWRCYWxhbmNlclVSTCcsIHtcclxuICAgICAgdmFsdWU6IGBodHRwOi8vJHtmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX1gLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1VSTCBvZiB0aGUgYXBwbGljYXRpb24nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NsdXN0ZXJOYW1lJywge1xyXG4gICAgICB2YWx1ZTogY2x1c3Rlci5jbHVzdGVyTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdOYW1lIG9mIHRoZSBFQ1MgY2x1c3RlcicsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VydmljZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBmYXJnYXRlU2VydmljZS5zZXJ2aWNlLnNlcnZpY2VOYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIEVDUyBzZXJ2aWNlJyxcclxuICAgIH0pO1xyXG4gIH1cclxufSJdfQ==