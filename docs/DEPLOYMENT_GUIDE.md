# AWS Cloud Deployment & Operations Guide

**System:** Agriculture Supply Chain Platform  
**Target Infrastructure:** Amazon Web Services (S3, CloudFront OAC, App Runner, CloudWatch, ECR)  
**IaC Source:** [`aws/cloudformation-template.yaml`](file:///c:/Users/ADMIN/Documents/Agriculture_Supplychain/agri-chain-supply-management/aws/cloudformation-template.yaml)  

---

## 1. Prerequisites & Required Tools

Before commencing an AWS deployment, ensure the following are available on your deployment terminal:
* **AWS CLI v2** configured with credentials (`aws configure`) having permissions for S3, CloudFront, App Runner, IAM, and CloudWatch.
* **Docker Desktop / Engine** for container building.
* **Node.js 20+ and npm 10+** for static asset bundling.
* **Managed Database:** A MongoDB Atlas cluster (or AWS DocumentDB) with TLS enabled.
* **MongoDB Network Connectivity Architecture:**
  * AWS App Runner operates with **dynamic outbound public IP addresses**. It does not have fixed static egress IPs by default.
  * *Option A (Direct Internet Connectivity):* If connecting to MongoDB Atlas over the public internet, Atlas must accept connections from App Runner's outbound IP ranges, secured with TLS (`mongodb+srv://`) and strong SCRAM credential authentication. Never open database access without authentication.
  * *Option B (VPC Connector Architecture - Enterprise Recommended):* To restrict database access to private IPs or fixed NAT Gateway elastic IPs, provision an AWS VPC with an `AWS::AppRunner::VpcConnector`. This requires dedicated VPC networking subnets and is documented as an optional infrastructure enhancement.
* **Secrets Encryption:** Secrets are encrypted by default using the AWS-managed key (`aws/secretsmanager`). If using a Customer-Managed KMS Key (CMK), specify `KmsKeyArn`.

> **Honest Status Note:** This project includes production-ready CloudFormation templates, Dockerfiles, and deployment procedures. Local CLI validation (`aws cloudformation validate-template` / `cfn-lint`) was **NOT RUN** on this development machine because the AWS CLI is not installed locally. Live cloud resources have NOT yet been provisioned to avoid unapproved financial charges to your AWS account. Follow the instructions below whenever you choose to execute a live deployment.

---

## 2. Step-by-Step Deployment Procedure

### Step 1: Create Amazon ECR Repository & Push Backend Container
```bash
# 1. Export deployment variables
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REPO_NAME="agri-chain-backend"

# 2. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# 3. Create private ECR repository (if not already existing)
aws ecr create-repository --repository-name $REPO_NAME --region $AWS_REGION || true

# 4. Build and tag the backend container image
cd agri-chain-supply-management/backend
docker build -t ${REPO_NAME}:latest .
docker tag ${REPO_NAME}:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:latest

# 5. Push container image to private ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:latest
cd ../..
```

### Step 2: Provision Secrets in AWS Secrets Manager
```bash
# 1. Create Secrets Manager Secret for JWT Signing Key (64-character hex material)
export JWT_SECRET_ARN=$(aws secretsmanager create-secret \
  --name "agri-chain/production/jwt-secret" \
  --description "Production JWT signing secret for Agriculture Supply Chain API" \
  --secret-string "$(openssl rand -hex 32)" \
  --region $AWS_REGION \
  --query ARN --output text)

# 2. Create Secrets Manager Secret for Managed MongoDB Connection URI
export DB_SECRET_ARN=$(aws secretsmanager create-secret \
  --name "agri-chain/production/mongodb-uri" \
  --description "Production MongoDB connection string for Agriculture Supply Chain API" \
  --secret-string "mongodb+srv://admin:YourSecurePassword@cluster0.mongodb.net/agri_chain?retryWrites=true&w=majority" \
  --region $AWS_REGION \
  --query ARN --output text)

# 3. (Optional) Create Secrets Manager Secret for Authenticated Sepolia RPC Endpoint
# export RPC_SECRET_ARN=$(aws secretsmanager create-secret \
#   --name "agri-chain/production/sepolia-rpc" \
#   --description "Production Ethereum Sepolia RPC URL with Alchemy/Infura API Key" \
#   --secret-string "https://eth-sepolia.g.alchemy.com/v2/YOUR_SECRET_API_KEY" \
#   --region $AWS_REGION \
#   --query ARN --output text)

echo "JWT Secret ARN:      $JWT_SECRET_ARN"
echo "Database Secret ARN: $DB_SECRET_ARN"
```

### Step 3: Deploy CloudFormation Infrastructure Stack
```bash
# Deploy CloudFormation stack provisioning S3, CloudFront OAC, App Runner, and CloudWatch
aws cloudformation deploy \
  --template-file agri-chain-supply-management/aws/cloudformation-template.yaml \
  --stack-name agriculture-supply-chain-prod \
  --parameter-overrides \
      ProjectName="agri-chain" \
      Environment="production" \
      BackendImageIdentifier="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:latest" \
      JwtSecretArn="${JWT_SECRET_ARN}" \
      DatabaseSecretArn="${DB_SECRET_ARN}" \
      ContractAddress="0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION
```


### Step 4: Extract Stack Outputs
```bash
# Query S3 bucket name and CloudFront domain
export S3_BUCKET=$(aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --query "Stacks[0].Outputs[?OutputKey=='FrontendS3BucketName'].OutputValue" --output text)
export CF_DIST_ID=$(aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)
export API_URL=$(aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --query "Stacks[0].Outputs[?OutputKey=='BackendServiceURL'].OutputValue" --output text)

echo "S3 Bucket:         $S3_BUCKET"
echo "CloudFront ID:     $CF_DIST_ID"
echo "Backend API URL:   $API_URL"
```

### Step 5: Build & Upload Frontend Static Artifacts
```bash
cd agri-chain-supply-management/frontend

# Build Vite SPA with production API URL
VITE_API_URL="${API_URL}/api" \
VITE_CONTRACT_ADDRESS="0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D" \
VITE_CHAIN_ID="11155111" \
npm run build

# Sync static build to private S3 bucket
aws s3 sync dist/ s3://${S3_BUCKET}/ --delete --cache-control "public, max-age=31536000, immutable"
aws s3 cp dist/index.html s3://${S3_BUCKET}/index.html --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront edge cache
aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
cd ../..
```

---

## 3. Post-Deployment Verification & Smoke Testing

1. **Verify Backend Liveness:**
   ```bash
   curl -I https://${API_URL}/api/health
   # Expected: HTTP/2 200 OK with {"status":"healthy"}
   ```
2. **Verify Frontend CDN Delivery:**
   ```bash
   export CF_URL=$(aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionURL'].OutputValue" --output text)
   curl -I ${CF_URL}
   # Expected: HTTP/2 200 OK with server: CloudFront
   ```
3. **Verify S3 Direct Access Block:**
   ```bash
   curl -I https://${S3_BUCKET}.s3.amazonaws.com/index.html
   # Expected: HTTP/1.1 403 Forbidden (Guarantees public bypass is impossible)
   ```

---

## 4. Teardown & Resource Cleanup

To completely remove provisioned cloud resources and stop all AWS billing:
```bash
# 1. Empty the private S3 bucket (buckets with contents cannot be deleted by CloudFormation)
aws s3 rm s3://${S3_BUCKET} --recursive

# 2. Delete the CloudFormation stack
aws cloudformation delete-stack --stack-name agriculture-supply-chain-prod --region $AWS_REGION

# 3. Delete the ECR repository
aws ecr delete-repository --repository-name agri-chain-backend --force --region $AWS_REGION
```

---

## 5. Blockchain & Database Consistency Recovery Architecture

### Dual-State Transaction Model
The Agriculture Supply Chain system coordinates two independent data tiers:
1. **Decentralized Ledger (Ethereum Sepolia):** State advances via a signed transaction mined on the `AgriChain` smart contract.
2. **Off-Chain Persistent Database (MongoDB):** State advances via atomic conditional update (`Product.findOneAndUpdate`).

### Recovery Behavior upon Transient Database Failure
* **Failure Scenario:** An on-chain transaction succeeds on Ethereum Sepolia, but the subsequent HTTP database call fails due to a network timeout, server restart, or database connectivity issue.
* **Database State:** The MongoDB record remains at the prior lifecycle status (e.g., `Created`), and the transaction hash (`txHash`) has not been appended to the product's `history` array.
* **Client Retry Recovery:** Because the product is still in `expectedStatus` and `history.txHash: { $ne: txHash }` is satisfied, the client can safely re-submit the request with the identical `txHash`. The backend re-verifies the mined receipt against Ethereum Sepolia and atomically applies the state transition.
* **Operational Limitation (Absence of Autonomous Reconciler):** The system does not currently feature a background event-listening daemon or cron worker to independently query the smart contract and backfill unrecorded transitions if a client disconnects and never retries. Operational recovery in this edge case requires a client retry or an operator initiating the update with the transaction hash.
