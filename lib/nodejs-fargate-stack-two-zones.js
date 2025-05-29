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
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class NodejsFargateStack extends cdk.Stack {
    constructor(scope, id, props = {}) {
        super(scope, id, props);
        // Configuration with defaults
        const appName = props.appName || 'nodejs-fargate-app';
        const environment = props.environment || 'dev';
        const containerPort = props.containerPort || 3000;
        const desiredCount = props.desiredCount || 2;
        const cpu = props.cpu || 256;
        const memory = props.memory || 512;
        // Create VPC with public and private subnets across 2 AZs
        const vpc = new ec2.Vpc(this, 'Vpc', {
            maxAzs: 2,
            natGateways: 2,
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
        // Create CloudWatch Log Group
        const logGroup = new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/ecs/${appName}`,
            retention: logs.RetentionDays.TWO_WEEKS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
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
                logDriver: ecs.LogDrivers.awsLogs({
                    streamPrefix: 'ecs',
                    logGroup: logGroup,
                }),
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
        // Configure auto scaling
        const scalableTarget = fargateService.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 10,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzLWZhcmdhdGUtc3RhY2stdHdvLXpvbmVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm9kZWpzLWZhcmdhdGUtc3RhY2stdHdvLXpvbmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMEVBQTREO0FBQzVELDJEQUE2QztBQVk3QyxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSS9DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsUUFBaUMsRUFBRTtRQUMzRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4QkFBOEI7UUFDOUIsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxvQkFBb0IsQ0FBQztRQUN0RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztRQUMvQyxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQztRQUNsRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxJQUFJLENBQUMsQ0FBQztRQUM3QyxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQztRQUM3QixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQztRQUVuQywwREFBMEQ7UUFDMUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7WUFDbkMsTUFBTSxFQUFFLENBQUM7WUFDVCxXQUFXLEVBQUUsQ0FBQztZQUNkLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUUsR0FBRyxDQUFDLFVB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QUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxXQUFXO1lBQzFCLFdBQVcsRUFBRSx5QkFBeUI7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxPQUFPLENBQUMsV0FBVztZQUN6QyxXQUFXLEVBQUUseUJBQXlCO1NBQ3ZDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTNJRCxnREEySUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XHJcbmltcG9ydCAqIGFzIGVjcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNzJztcclxuaW1wb3J0ICogYXMgZWNzUGF0dGVybnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcy1wYXR0ZXJucyc7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuXHJcbmludGVyZmFjZSBOb2RlanNGYXJnYXRlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICBhcHBOYW1lPzogc3RyaW5nO1xyXG4gIGVudmlyb25tZW50Pzogc3RyaW5nO1xyXG4gIGNvbnRhaW5lclBvcnQ/OiBudW1iZXI7XHJcbiAgZGVzaXJlZENvdW50PzogbnVtYmVyO1xyXG4gIGNwdT86IG51bWJlcjtcclxuICBtZW1vcnk/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBOb2RlanNGYXJnYXRlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBsb2FkQmFsYW5jZXJEbnM6IHN0cmluZztcclxuICBwdWJsaWMgcmVhZG9ubHkgZWNyUmVwb3NpdG9yeTogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTm9kZWpzRmFyZ2F0ZVN0YWNrUHJvcHMgPSB7fSkge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJhdGlvbiB3aXRoIGRlZmF1bHRzXHJcbiAgICBjb25zdCBhcHBOYW1lID0gcHJvcHMuYXBwTmFtZSB8fCAnbm9kZWpzLWZhcmdhdGUtYXBwJztcclxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHMuZW52aXJvbm1lbnQgfHwgJ2Rldic7XHJcbiAgICBjb25zdCBjb250YWluZXJQb3J0ID0gcHJvcHMuY29udGFpbmVyUG9ydCB8fCAzMDAwO1xyXG4gICAgY29uc3QgZGVzaXJlZENvdW50ID0gcHJvcHMuZGVzaXJlZENvdW50IHx8IDI7XHJcbiAgICBjb25zdCBjcHUgPSBwcm9wcy5jcHUgfHwgMjU2O1xyXG4gICAgY29uc3QgbWVtb3J5ID0gcHJvcHMubWVtb3J5IHx8IDUxMjtcclxuXHJcbiAgICAvLyBDcmVhdGUgVlBDIHdpdGggcHVibGljIGFuZCBwcml2YXRlIHN1Ym5ldHMgYWNyb3NzIDIgQVpzXHJcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnVnBjJywge1xyXG4gICAgICBtYXhBenM6IDIsXHJcbiAgICAgIG5hdEdhdGV3YXlzOiAyLFxyXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxyXG4gICAgICAgICAgbmFtZTogJ1B1YmxpYycsXHJcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBjaWRyTWFzazogMjQsXHJcbiAgICAgICAgICBuYW1lOiAnUHJpdmF0ZScsXHJcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDcmVhdGUgRUNTIENsdXN0ZXJcclxuICAgIGNvbnN0IGNsdXN0ZXIgPSBuZXcgZWNzLkNsdXN0ZXIodGhpcywgJ0NsdXN0ZXInLCB7XHJcbiAgICAgIHZwYyxcclxuICAgICAgY2x1c3Rlck5hbWU6IGAke2FwcE5hbWV9LWNsdXN0ZXJgLFxyXG4gICAgICBjb250YWluZXJJbnNpZ2h0czogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIExvZyBHcm91cFxyXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnTG9nR3JvdXAnLCB7XHJcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9lY3MvJHthcHBOYW1lfWAsXHJcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyZWF0ZSBGYXJnYXRlIFNlcnZpY2Ugd2l0aCBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyXHJcbiAgICAvLyBUaGlzIHBhdHRlcm4gYXV0b21hdGljYWxseSBjcmVhdGVzIEVDUiByZXBvLCBidWlsZHMgaW1hZ2UsIEFMQiwgdGFyZ2V0IGdyb3VwLCBldGMuXHJcbiAgICBjb25zdCBmYXJnYXRlU2VydmljZSA9IG5ldyBlY3NQYXR0ZXJucy5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlZEZhcmdhdGVTZXJ2aWNlKHRoaXMsICdGYXJnYXRlU2VydmljZScsIHtcclxuICAgICAgY2x1c3RlcixcclxuICAgICAgc2VydmljZU5hbWU6IGAke2FwcE5hbWV9LXNlcnZpY2VgLFxyXG4gICAgICB0YXNrSW1hZ2VPcHRpb25zOiB7XHJcbiAgICAgICAgLy8gQ0RLIHdpbGwgYXV0b21hdGljYWxseSBidWlsZCB0aGUgRG9ja2VyIGltYWdlIGZyb20gdGhlIHNwZWNpZmllZCBkaXJlY3RvcnlcclxuICAgICAgICBpbWFnZTogZWNzLkNvbnRhaW5lckltYWdlLmZyb21Bc3NldCgnLi9hcHAnLCB7XHJcbiAgICAgICAgICAvLyBPcHRpb25hbDogc3BlY2lmeSBwbGF0Zm9ybSBmb3IgbXVsdGktYXJjaCBidWlsZHNcclxuICAgICAgICAgIHBsYXRmb3JtOiBjZGsuYXdzX2Vjcl9hc3NldHMuUGxhdGZvcm0uTElOVVhfQU1ENjQsXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgY29udGFpbmVyTmFtZTogYXBwTmFtZSxcclxuICAgICAgICBjb250YWluZXJQb3J0OiBjb250YWluZXJQb3J0LFxyXG4gICAgICAgIGxvZ0RyaXZlcjogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7XHJcbiAgICAgICAgICBzdHJlYW1QcmVmaXg6ICdlY3MnLFxyXG4gICAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxyXG4gICAgICAgICAgUE9SVDogY29udGFpbmVyUG9ydC50b1N0cmluZygpLFxyXG4gICAgICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXHJcbiAgICAgICAgICBBUFBfVkVSU0lPTjogJzEuMC4wJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICBtZW1vcnlMaW1pdE1pQjogbWVtb3J5LFxyXG4gICAgICBjcHU6IGNwdSxcclxuICAgICAgZGVzaXJlZENvdW50OiBkZXNpcmVkQ291bnQsXHJcbiAgICAgIHB1YmxpY0xvYWRCYWxhbmNlcjogdHJ1ZSxcclxuICAgICAgbGlzdGVuZXJQb3J0OiA4MCxcclxuICAgICAgLy8gRGVwbG95IHRvIHByaXZhdGUgc3VibmV0cyBmb3Igc2VjdXJpdHlcclxuICAgICAgYXNzaWduUHVibGljSXA6IGZhbHNlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJlIGhlYWx0aCBjaGVja1xyXG4gICAgZmFyZ2F0ZVNlcnZpY2UudGFyZ2V0R3JvdXAuY29uZmlndXJlSGVhbHRoQ2hlY2soe1xyXG4gICAgICBwYXRoOiAnL2hlYWx0aCcsXHJcbiAgICAgIGhlYWx0aHlIdHRwQ29kZXM6ICcyMDAnLFxyXG4gICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcclxuICAgICAgaGVhbHRoeVRocmVzaG9sZENvdW50OiAyLFxyXG4gICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENvbmZpZ3VyZSBhdXRvIHNjYWxpbmdcclxuICAgIGNvbnN0IHNjYWxhYmxlVGFyZ2V0ID0gZmFyZ2F0ZVNlcnZpY2Uuc2VydmljZS5hdXRvU2NhbGVUYXNrQ291bnQoe1xyXG4gICAgICBtaW5DYXBhY2l0eTogMSxcclxuICAgICAgbWF4Q2FwYWNpdHk6IDEwLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU2NhbGUgYmFzZWQgb24gQ1BVIHV0aWxpemF0aW9uXHJcbiAgICBzY2FsYWJsZVRhcmdldC5zY2FsZU9uQ3B1VXRpbGl6YXRpb24oJ0NwdVNjYWxpbmcnLCB7XHJcbiAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogNzAsXHJcbiAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSxcclxuICAgICAgc2NhbGVPdXRDb29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNjYWxlIGJhc2VkIG9uIG1lbW9yeSB1dGlsaXphdGlvblxyXG4gICAgc2NhbGFibGVUYXJnZXQuc2NhbGVPbk1lbW9yeVV0aWxpemF0aW9uKCdNZW1vcnlTY2FsaW5nJywge1xyXG4gICAgICB0YXJnZXRVdGlsaXphdGlvblBlcmNlbnQ6IDgwLFxyXG4gICAgICBzY2FsZUluQ29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXHJcbiAgICAgIHNjYWxlT3V0Q29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdG9yZSBvdXRwdXRzXHJcbiAgICB0aGlzLmxvYWRCYWxhbmNlckRucyA9IGZhcmdhdGVTZXJ2aWNlLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lO1xyXG4gICAgdGhpcy5lY3JSZXBvc2l0b3J5ID0gZmFyZ2F0ZVNlcnZpY2UudGFza0RlZmluaXRpb24ub2J0YWluRXhlY3V0aW9uUm9sZSgpLnJvbGVBcm47XHJcblxyXG4gICAgLy8gQWRkIHRhZ3MgdG8gYWxsIHJlc291cmNlc1xyXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGVudmlyb25tZW50KTtcclxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQXBwbGljYXRpb24nLCBhcHBOYW1lKTtcclxuXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9hZEJhbGFuY2VyRE5TJywge1xyXG4gICAgICB2YWx1ZTogZmFyZ2F0ZVNlcnZpY2UubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnRE5TIG5hbWUgb2YgdGhlIGxvYWQgYmFsYW5jZXInLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xvYWRCYWxhbmNlclVSTCcsIHtcclxuICAgICAgdmFsdWU6IGBodHRwOi8vJHtmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZX1gLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1VSTCBvZiB0aGUgYXBwbGljYXRpb24nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NsdXN0ZXJOYW1lJywge1xyXG4gICAgICB2YWx1ZTogY2x1c3Rlci5jbHVzdGVyTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdOYW1lIG9mIHRoZSBFQ1MgY2x1c3RlcicsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU2VydmljZU5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBmYXJnYXRlU2VydmljZS5zZXJ2aWNlLnNlcnZpY2VOYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIEVDUyBzZXJ2aWNlJyxcclxuICAgIH0pO1xyXG4gIH1cclxufSJdfQ==