import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface NodejsFargateStackProps extends cdk.StackProps {
  appName?: string;
  environment?: string;
  containerPort?: number;
  desiredCount?: number;
  cpu?: number;
  memory?: number;
}

export class NodejsFargateStack extends cdk.Stack {
  public readonly loadBalancerDns: string;
  public readonly ecrRepository: string;

  constructor(scope: Construct, id: string, props: NodejsFargateStackProps = {}) {
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
      maxAzs: 2, // ALB requires minimum 2 AZs
      natGateways: 1, // Single NAT gateway shared across AZs
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