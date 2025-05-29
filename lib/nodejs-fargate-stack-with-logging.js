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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzLWZhcmdhdGUtc3RhY2std2l0aC1sb2dnaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibm9kZWpzLWZhcmdhdGUtc3RhY2std2l0aC1sb2dnaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMEVBQTREO0FBQzVELDJEQUE2QztBQVk3QyxNQUFhLGtCQUFtQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSS9DLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsUUFBaUMsRUFBRTtRQUMzRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4QkFBOEI7UUFDOUIsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxvQkFBb0IsQ0FBQztRQUN0RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztRQUMvQyxNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQztRQUNsRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxJQUFJLENBQUMsQ0FBQyxDQUFDLGtDQUFrQztRQUNoRixNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQztRQUM3QixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQztRQUVuQywwREFBMEQ7UUFDMUQsZ0ZBQWdGO1FBQ2hGLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO1lBQ25DLE1BQU0sRUFBRSxDQUFDO1lBQ1QsV0FBVyxFQUFFLENBQUM7WUFDZCxtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFB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QztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSxPQUFPLENBQUMsV0FBVztZQUMxQixXQUFXLEVBQUUseUJBQXlCO1NBQ3ZDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSxjQUFjLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDekMsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE1SUQsZ0RBNElDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xyXG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XHJcbmltcG9ydCAqIGFzIGVjc1BhdHRlcm5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MtcGF0dGVybnMnO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcblxyXG5pbnRlcmZhY2UgTm9kZWpzRmFyZ2F0ZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XHJcbiAgYXBwTmFtZT86IHN0cmluZztcclxuICBlbnZpcm9ubWVudD86IHN0cmluZztcclxuICBjb250YWluZXJQb3J0PzogbnVtYmVyO1xyXG4gIGRlc2lyZWRDb3VudD86IG51bWJlcjtcclxuICBjcHU/OiBudW1iZXI7XHJcbiAgbWVtb3J5PzogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgTm9kZWpzRmFyZ2F0ZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgbG9hZEJhbGFuY2VyRG5zOiBzdHJpbmc7XHJcbiAgcHVibGljIHJlYWRvbmx5IGVjclJlcG9zaXRvcnk6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE5vZGVqc0ZhcmdhdGVTdGFja1Byb3BzID0ge30pIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIENvbmZpZ3VyYXRpb24gd2l0aCBkZWZhdWx0c1xyXG4gICAgY29uc3QgYXBwTmFtZSA9IHByb3BzLmFwcE5hbWUgfHwgJ25vZGVqcy1mYXJnYXRlLWFwcCc7XHJcbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHByb3BzLmVudmlyb25tZW50IHx8ICdkZXYnO1xyXG4gICAgY29uc3QgY29udGFpbmVyUG9ydCA9IHByb3BzLmNvbnRhaW5lclBvcnQgfHwgMzAwMDtcclxuICAgIGNvbnN0IGRlc2lyZWRDb3VudCA9IHByb3BzLmRlc2lyZWRDb3VudCB8fCAxOyAvLyBSZWR1Y2VkIGRlZmF1bHQgZm9yIGxpZ2h0d2VpZ2h0XHJcbiAgICBjb25zdCBjcHUgPSBwcm9wcy5jcHUgfHwgMjU2O1xyXG4gICAgY29uc3QgbWVtb3J5ID0gcHJvcHMubWVtb3J5IHx8IDUxMjtcclxuXHJcbiAgICAvLyBDcmVhdGUgVlBDIHdpdGggcHVibGljIGFuZCBwcml2YXRlIHN1Ym5ldHMgYWNyb3NzIDIgQVpzXHJcbiAgICAvLyAoQUxCIHJlcXVpcmVzIGF0IGxlYXN0IDIgQVpzLCBidXQgd2UgY2FuIHN0aWxsIHNhdmUgY29zdHMgd2l0aCAxIE5BVCBnYXRld2F5KVxyXG4gICAgY29uc3QgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ1ZwYycsIHtcclxuICAgICAgbWF4QXpzOiAyLCAvLyBBTEIgcmVxdWlyZXMgbWluaW11bSAyIEFac1xyXG4gICAgICBuYXRHYXRld2F5czogMSwgLy8gU2luZ2xlIE5BVCBnYXRld2F5IHNoYXJlZCBhY3Jvc3MgQVpzXHJcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBjaWRyTWFzazogMjQsXHJcbiAgICAgICAgICBuYW1lOiAnUHVibGljJyxcclxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBVQkxJQyxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcclxuICAgICAgICAgIG5hbWU6ICdQcml2YXRlJyxcclxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyZWF0ZSBFQ1MgQ2x1c3RlclxyXG4gICAgY29uc3QgY2x1c3RlciA9IG5ldyBlY3MuQ2x1c3Rlcih0aGlzLCAnQ2x1c3RlcicsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBjbHVzdGVyTmFtZTogYCR7YXBwTmFtZX0tY2x1c3RlcmAsXHJcbiAgICAgIGNvbnRhaW5lckluc2lnaHRzOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggTG9nIEdyb3VwXHJcbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdMb2dHcm91cCcsIHtcclxuICAgICAgbG9nR3JvdXBOYW1lOiBgL2Vjcy8ke2FwcE5hbWV9YCxcclxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuVFdPX1dFRUtTLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIEZhcmdhdGUgU2VydmljZSB3aXRoIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXJcclxuICAgIC8vIFRoaXMgcGF0dGVybiBhdXRvbWF0aWNhbGx5IGNyZWF0ZXMgRUNSIHJlcG8sIGJ1aWxkcyBpbWFnZSwgQUxCLCB0YXJnZXQgZ3JvdXAsIGV0Yy5cclxuICAgIGNvbnN0IGZhcmdhdGVTZXJ2aWNlID0gbmV3IGVjc1BhdHRlcm5zLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2UodGhpcywgJ0ZhcmdhdGVTZXJ2aWNlJywge1xyXG4gICAgICBjbHVzdGVyLFxyXG4gICAgICBzZXJ2aWNlTmFtZTogYCR7YXBwTmFtZX0tc2VydmljZWAsXHJcbiAgICAgIHRhc2tJbWFnZU9wdGlvbnM6IHtcclxuICAgICAgICAvLyBDREsgd2lsbCBhdXRvbWF0aWNhbGx5IGJ1aWxkIHRoZSBEb2NrZXIgaW1hZ2UgZnJvbSB0aGUgc3BlY2lmaWVkIGRpcmVjdG9yeVxyXG4gICAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUFzc2V0KCcuL2FwcCcsIHtcclxuICAgICAgICAgIC8vIE9wdGlvbmFsOiBzcGVjaWZ5IHBsYXRmb3JtIGZvciBtdWx0aS1hcmNoIGJ1aWxkc1xyXG4gICAgICAgICAgcGxhdGZvcm06IGNkay5hd3NfZWNyX2Fzc2V0cy5QbGF0Zm9ybS5MSU5VWF9BTUQ2NCxcclxuICAgICAgICB9KSxcclxuICAgICAgICBjb250YWluZXJOYW1lOiBhcHBOYW1lLFxyXG4gICAgICAgIGNvbnRhaW5lclBvcnQ6IGNvbnRhaW5lclBvcnQsXHJcbiAgICAgICAgbG9nRHJpdmVyOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcclxuICAgICAgICAgIHN0cmVhbVByZWZpeDogJ2VjcycsXHJcbiAgICAgICAgICBsb2dHcm91cDogbG9nR3JvdXAsXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXHJcbiAgICAgICAgICBQT1JUOiBjb250YWluZXJQb3J0LnRvU3RyaW5nKCksXHJcbiAgICAgICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcclxuICAgICAgICAgIEFQUF9WRVJTSU9OOiAnMS4wLjAnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiBtZW1vcnksXHJcbiAgICAgIGNwdTogY3B1LFxyXG4gICAgICBkZXNpcmVkQ291bnQ6IGRlc2lyZWRDb3VudCxcclxuICAgICAgcHVibGljTG9hZEJhbGFuY2VyOiB0cnVlLFxyXG4gICAgICBsaXN0ZW5lclBvcnQ6IDgwLFxyXG4gICAgICAvLyBEZXBsb3kgdG8gcHJpdmF0ZSBzdWJuZXRzIGZvciBzZWN1cml0eVxyXG4gICAgICBhc3NpZ25QdWJsaWNJcDogZmFsc2UsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDb25maWd1cmUgaGVhbHRoIGNoZWNrXHJcbiAgICBmYXJnYXRlU2VydmljZS50YXJnZXRHcm91cC5jb25maWd1cmVIZWFsdGhDaGVjayh7XHJcbiAgICAgIHBhdGg6ICcvaGVhbHRoJyxcclxuICAgICAgaGVhbHRoeUh0dHBDb2RlczogJzIwMCcsXHJcbiAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDUpLFxyXG4gICAgICBoZWFsdGh5VGhyZXNob2xkQ291bnQ6IDIsXHJcbiAgICAgIHVuaGVhbHRoeVRocmVzaG9sZENvdW50OiAyLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJlIGF1dG8gc2NhbGluZyAocmVkdWNlZCBjYXBhY2l0eSBmb3IgbGlnaHR3ZWlnaHQpXHJcbiAgICBjb25zdCBzY2FsYWJsZVRhcmdldCA9IGZhcmdhdGVTZXJ2aWNlLnNlcnZpY2UuYXV0b1NjYWxlVGFza0NvdW50KHtcclxuICAgICAgbWluQ2FwYWNpdHk6IDEsXHJcbiAgICAgIG1heENhcGFjaXR5OiA1LCAvLyBSZWR1Y2VkIGZyb20gMTAgZm9yIGxpZ2h0d2VpZ2h0XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTY2FsZSBiYXNlZCBvbiBDUFUgdXRpbGl6YXRpb25cclxuICAgIHNjYWxhYmxlVGFyZ2V0LnNjYWxlT25DcHVVdGlsaXphdGlvbignQ3B1U2NhbGluZycsIHtcclxuICAgICAgdGFyZ2V0VXRpbGl6YXRpb25QZXJjZW50OiA3MCxcclxuICAgICAgc2NhbGVJbkNvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLFxyXG4gICAgICBzY2FsZU91dENvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU2NhbGUgYmFzZWQgb24gbWVtb3J5IHV0aWxpemF0aW9uXHJcbiAgICBzY2FsYWJsZVRhcmdldC5zY2FsZU9uTWVtb3J5VXRpbGl6YXRpb24oJ01lbW9yeVNjYWxpbmcnLCB7XHJcbiAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogODAsXHJcbiAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSxcclxuICAgICAgc2NhbGVPdXRDb29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0b3JlIG91dHB1dHNcclxuICAgIHRoaXMubG9hZEJhbGFuY2VyRG5zID0gZmFyZ2F0ZVNlcnZpY2UubG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWU7XHJcbiAgICB0aGlzLmVjclJlcG9zaXRvcnkgPSBmYXJnYXRlU2VydmljZS50YXNrRGVmaW5pdGlvbi5vYnRhaW5FeGVjdXRpb25Sb2xlKCkucm9sZUFybjtcclxuXHJcbiAgICAvLyBBZGQgdGFncyB0byBhbGwgcmVzb3VyY2VzXHJcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgZW52aXJvbm1lbnQpO1xyXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdBcHBsaWNhdGlvbicsIGFwcE5hbWUpO1xyXG5cclxuICAgIC8vIE91dHB1dHNcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMb2FkQmFsYW5jZXJETlMnLCB7XHJcbiAgICAgIHZhbHVlOiBmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246ICdETlMgbmFtZSBvZiB0aGUgbG9hZCBiYWxhbmNlcicsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTG9hZEJhbGFuY2VyVVJMJywge1xyXG4gICAgICB2YWx1ZTogYGh0dHA6Ly8ke2ZhcmdhdGVTZXJ2aWNlLmxvYWRCYWxhbmNlci5sb2FkQmFsYW5jZXJEbnNOYW1lfWAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnVVJMIG9mIHRoZSBhcHBsaWNhdGlvbicsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2x1c3Rlck5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBjbHVzdGVyLmNsdXN0ZXJOYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIEVDUyBjbHVzdGVyJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZXJ2aWNlTmFtZScsIHtcclxuICAgICAgdmFsdWU6IGZhcmdhdGVTZXJ2aWNlLnNlcnZpY2Uuc2VydmljZU5hbWUsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTmFtZSBvZiB0aGUgRUNTIHNlcnZpY2UnLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59Il19