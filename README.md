# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

## Windows Install
https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi


## Install Docker 
https://docs.docker.com/desktop/setup/install/windows-install/

# Install CDK globally
npm install -g aws-cdk
or 
npm i @aws-cdk/aws-ec2

# Verify installations
aws --version
PC: aws-cli/2.27.24 Python/3.13.3 Windows/10 exe/AMD64


cdk --version
PC: 2.1014.0 (build e4c6a17)

# Option 1: Configure default profile
aws configure

# Option 2: Use existing profile
export AWS_PROFILE=your-profile-name

# Option 3: Use environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=eu-west-2

# This creates the CDK toolkit resources in your AWS account
cdk bootstrap

# You should see output like:
# ⏳  Bootstrapping environment aws://123456789012/eu-west-2...
# ✅  Environment aws://123456789012/eu-west-2 bootstrapped.


# Install some magic
npm install

# Build TypeScript
npm run build

# Preview changes (optional but recommended)
cdk diff

# Deploy
npm run deploy-dev

# Links
NodejsFargateDevStack.ClusterName = nodejs-fargate-app-cluster
NodejsFargateDevStack.FargateServiceLoadBalancerDNS9433D5F6 = Nodejs-Farga-VjTIJGWmsfLc-636969047.eu-west-2.elb.amazonaws.com
NodejsFargateDevStack.FargateServiceServiceURL47701F45 = http://Nodejs-Farga-VjTIJGWmsfLc-636969047.eu-west-2.elb.amazonaws.com
NodejsFargateDevStack.LoadBalancerDNS = Nodejs-Farga-VjTIJGWmsfLc-636969047.eu-west-2.elb.amazonaws.com
NodejsFargateDevStack.LoadBalancerURL = http://Nodejs-Farga-VjTIJGWmsfLc-636969047.eu-west-2.elb.amazonaws.com
NodejsFargateDevStack.ServiceName = nodejs-fargate-app-service


15:26 - Started.



# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
