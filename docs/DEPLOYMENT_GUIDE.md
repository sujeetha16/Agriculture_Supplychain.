# AWS Cloud Deployment & Operations Guide

**System:** Agriculture Supply Chain Platform  
**Target Infrastructure:** Amazon Web Services (Amazon S3, CloudFront with Origin Access Control, AWS App Runner, Amazon CloudWatch, Amazon ECR, and AWS Secrets Manager)
**Infrastructure as Code:** [`aws/cloudformation-template.yaml`](../aws/cloudformation-template.yaml)

---

## 1. Prerequisites and Required Tools

Before commencing an AWS deployment, ensure the following prerequisites are satisfied.

- **AWS CLI v2:** Installed and configured with an AWS account and credentials that have the permissions required by the deployment.
- **Docker Desktop or Docker Engine:** Required to build and publish the backend container image.
- **Node.js 20+ and npm 10+:** Required to install dependencies and build the frontend.
- **Managed database:** A MongoDB Atlas cluster or an appropriately configured AWS DocumentDB deployment, with TLS enabled and valid authentication.
- **Amazon ECR:** A private repository containing the backend container image before the CloudFormation deployment begins.
- **AWS Secrets Manager:** Secrets containing the JWT signing key and MongoDB connection URI must exist before deployment. Their ARNs are passed as CloudFormation parameters.
- **Blockchain configuration (UNVERIFIED CONTRACT PREREQUISITE):** The smart contract address `0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D` is referenced throughout project records (`frontend/src/contracts/AgriChain.json`, `backend/contracts/AgriChain.json`, `cloudformation-template.yaml`). However, because no transaction receipt or on-chain verification proof is recorded in the repository and live network interaction is prohibited during this audit, this address is classified as **UNVERIFIED (OPERATOR PREREQUISITE)**. Before production stack deployment, the cloud operator must verify that this address contains deployed bytecode matching `AgriChain.sol` on Sepolia (e.g. via Etherscan) or deploy a new contract instance using `blockchain/scripts/deploy.js` and provide the verified address to both CloudFormation (`ContractAddress`) and the frontend build (`VITE_CONTRACT_ADDRESS`).
- **Frontend Environment Variables:**
  - `VITE_API_URL`: **Required** for production builds. Must point to the backend App Runner service with the `/api` route prefix (e.g., `https://<service-id>.<region>.awsapprunner.com/api`).
  - `VITE_CONTRACT_ADDRESS`: **Optional override**. Defaults to the embedded project address (`0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D`).
  - `VITE_CHAIN_ID`: **Optional override**. Defaults to `11155111` (Sepolia).
  - `VITE_SEPOLIA_RPC_URL`: **Optional**. Specifies a public Sepolia JSON-RPC gateway URL. If omitted, the frontend automatically falls back to resilient public Sepolia gateways (`https://ethereum-sepolia-rpc.publicnode.com`, `https://rpc.sepolia.org`, `https://1rpc.io/sepolia`). **Security Warning:** NEVER supply privileged or authenticated RPC credentials (e.g. Infura/Alchemy secret keys) in frontend environment variables, as Vite compiles all `VITE_*` variables directly into public client-side JavaScript bundles.
- **Shell environment:** The commands in this guide provide both Bash syntax (Section 2) and native Windows PowerShell syntax (Section 2, Step 6). Both procedures follow identical prerequisite checks, safe error handling, and security protections.

### MongoDB network connectivity

AWS App Runner's default outbound connectivity does not provide a fixed public egress IP address for database allowlisting.

- **Option A - Public database connectivity:** Configure MongoDB Atlas networking, authentication, and TLS appropriately. Do not assume that App Runner's changing outbound addresses can be safely allowlisted as a fixed IP.
- **Option B - VPC connector and controlled egress:** For fixed outbound IPs, a suitable VPC networking architecture with private subnets and a NAT gateway using an Elastic IP may be required. Private database connectivity requires a compatible network design. These components must be configured separately unless they are explicitly included in the infrastructure template.
### Secrets encryption

AWS Secrets Manager encrypts secrets at rest by default using an AWS-managed KMS key. A customer-managed KMS key can be used when required, provided the necessary permissions and configuration are in place.

> **Honest Status Note:** The CloudFormation template has passed local `cfn-lint` validation with exit code 0. `git diff --check` reported no whitespace errors; Git did emit a Windows LF-to-CRLF line-ending warning. These local checks do not guarantee successful AWS deployment or runtime operation. AWS CLI template validation and live deployment have not been performed. No AWS resources have been created as part of this local validation process. Deployment remains pending further review and explicit approval because AWS services may incur charges.

---

## 2. Step-by-Step Deployment Procedure

**Important:** The following commands are examples for a future, explicitly approved deployment. They create or modify cloud resources and may incur charges. Review the AWS account, region, parameters, permissions, and estimated costs before running them.

### Step 1: Create the Amazon ECR repository and publish the backend image

Run these commands from the repository root in Bash.

```bash
# 1. Configure deployment variables
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export REPO_NAME="agri-chain-backend"

# 2. Confirm the active AWS identity and region
aws sts get-caller-identity
aws configure get region
# 3. Check whether the private ECR repository exists safely
# Only a confirmed RepositoryNotFoundException is treated as a missing repository.
# Permission, authentication, region, and network errors immediately stop the procedure without attempting resource creation.
if aws ecr describe-repositories \
  --repository-names "$REPO_NAME" \
  --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "ECR repository verified: $REPO_NAME"
else
  ECR_ERR=$(aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" 2>&1 || true)
  if echo "$ECR_ERR" | grep -q "RepositoryNotFoundException"; then
    echo "ECR repository '$REPO_NAME' not found in account $AWS_ACCOUNT_ID ($AWS_REGION)."
    echo "Confirmed missing (RepositoryNotFoundException). Creating private ECR repository..."
    aws ecr create-repository \
      --repository-name "$REPO_NAME" \
      --region "$AWS_REGION" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256
    echo "ECR repository created successfully: $REPO_NAME"
  else
    echo "CRITICAL: ECR check failed due to permission, authentication, network, or region error:" >&2
    echo "$ECR_ERR" >&2
    echo "Halting procedure without attempting resource creation. Resolve credentials and IAM permissions first." >&2
    exit 1
  fi
fi

# 4. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region "$AWS_REGION" |
  docker login \
    --username AWS \
    --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# 5. Build, tag, and publish the backend image
cd agri-chain-supply-management/backend

docker build -t "${REPO_NAME}:latest" .

docker tag "${REPO_NAME}:latest" \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:latest"

docker push \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:latest"

cd ../..
```

**Note:** Creating an ECR repository and uploading an image can incur storage charges. Reusing an existing repository avoids unnecessary duplicate resources.

### Step 2: Provision application secrets in AWS Secrets Manager

The CloudFormation stack requires Secrets Manager Secret ARNs for the JWT signing key and MongoDB connection URI. Before creating new secrets, check whether they already exist to avoid duplicate resources and charges.

```bash
export JWT_SECRET_NAME="agri-chain/production/jwt-secret"
export DB_SECRET_NAME="agri-chain/production/mongodb-uri"

# 1. Safe JWT Secret check: only confirmed ResourceNotFoundException triggers creation
# Permission, authentication, region, and network errors immediately stop the procedure without attempting creation.
JWT_CHECK_ERR=$(aws secretsmanager describe-secret --secret-id "$JWT_SECRET_NAME" --region "$AWS_REGION" 2>&1 || true)

if aws secretsmanager describe-secret --secret-id "$JWT_SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "JWT secret verified in Secrets Manager: $JWT_SECRET_NAME"
  export JWT_SECRET_ARN="$(aws secretsmanager describe-secret \
    --secret-id "$JWT_SECRET_NAME" \
    --region "$AWS_REGION" \
    --query ARN \
    --output text)"
elif echo "$JWT_CHECK_ERR" | grep -q "ResourceNotFoundException"; then
  echo "JWT secret '$JWT_SECRET_NAME' does not exist (ResourceNotFoundException)."
  echo "Creating cryptographically random 256-bit JWT signing secret..."
  JWT_SECRET_VALUE="$(openssl rand -hex 32)"
  export JWT_SECRET_ARN="$(aws secretsmanager create-secret \
    --name "$JWT_SECRET_NAME" \
    --description "JWT signing secret for Agriculture Supply Chain API" \
    --secret-string "$JWT_SECRET_VALUE" \
    --region "$AWS_REGION" \
    --query ARN \
    --output text)"
  # Erase the raw plaintext secret from shell memory immediately
  unset JWT_SECRET_VALUE
  echo "JWT secret created successfully."
else
  echo "CRITICAL: Secrets Manager check failed for JWT secret due to credentials, network, or permission error:" >&2
  echo "$JWT_CHECK_ERR" >&2
  echo "Halting procedure without attempting secret creation. Resolve AWS credentials and IAM permissions first." >&2
  exit 1
fi

# 2. Safe Database URI Secret check: only confirmed ResourceNotFoundException triggers creation
DB_CHECK_ERR=$(aws secretsmanager describe-secret --secret-id "$DB_SECRET_NAME" --region "$AWS_REGION" 2>&1 || true)

if aws secretsmanager describe-secret --secret-id "$DB_SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Database secret verified in Secrets Manager: $DB_SECRET_NAME"
  export DB_SECRET_ARN="$(aws secretsmanager describe-secret \
    --secret-id "$DB_SECRET_NAME" \
    --region "$AWS_REGION" \
    --query ARN \
    --output text)"
elif echo "$DB_CHECK_ERR" | grep -q "ResourceNotFoundException"; then
  echo "Database secret '$DB_SECRET_NAME' does not exist (ResourceNotFoundException)."
  # Securely prompt operator without echoing or exposing URI in shell history
  read -rsp "Enter MongoDB connection URI: " DB_URI
  echo
  if [ -z "$DB_URI" ]; then
    echo "ERROR: MongoDB connection URI cannot be empty. Halting." >&2
    exit 1
  fi
  export DB_SECRET_ARN="$(aws secretsmanager create-secret \
    --name "$DB_SECRET_NAME" \
    --description "MongoDB connection URI for Agriculture Supply Chain API" \
    --secret-string "$DB_URI" \
    --region "$AWS_REGION" \
    --query ARN \
    --output text)"
  # Erase the raw plaintext URI from shell memory immediately
  unset DB_URI
  echo "Database secret created successfully."
else
  echo "CRITICAL: Secrets Manager check failed for database secret due to credentials, network, or permission error:" >&2
  echo "$DB_CHECK_ERR" >&2
  echo "Halting procedure without attempting secret creation. Resolve AWS credentials and IAM permissions first." >&2
  exit 1
fi

# Display ARNs only; never print secret values
printf 'JWT Secret ARN: %s\n' "$JWT_SECRET_ARN"
printf 'Database Secret ARN: %s\n' "$DB_SECRET_ARN"
```

**Optional Authenticated Sepolia RPC Secret:** If the backend requires an authenticated Ethereum Sepolia RPC endpoint (such as an Alchemy or Infura endpoint with an embedded secret API key), provision it as a separate secret and pass its ARN via the `SepoliaRpcSecretArn` parameter. Only confirmed `ResourceNotFoundException` prompts for creation:

```bash
export RPC_SECRET_NAME="agri-chain/production/sepolia-rpc"
export RPC_SECRET_ARN=""
RPC_CHECK_ERR=$(aws secretsmanager describe-secret --secret-id "$RPC_SECRET_NAME" --region "$AWS_REGION" 2>&1 || true)

if aws secretsmanager describe-secret --secret-id "$RPC_SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Optional Sepolia RPC secret verified: $RPC_SECRET_NAME"
  export RPC_SECRET_ARN="$(aws secretsmanager describe-secret \
    --secret-id "$RPC_SECRET_NAME" \
    --region "$AWS_REGION" \
    --query ARN \
    --output text)"
elif echo "$RPC_CHECK_ERR" | grep -q "ResourceNotFoundException"; then
  echo "Optional Sepolia RPC secret does not exist."
  read -rsp "Enter Authenticated Sepolia RPC URL (or press Enter to use built-in public RPCs): " RPC_URL
  echo
  if [ -n "$RPC_URL" ]; then
    export RPC_SECRET_ARN="$(aws secretsmanager create-secret \
      --name "$RPC_SECRET_NAME" \
      --description "Authenticated Sepolia RPC URL for Agriculture Supply Chain" \
      --secret-string "$RPC_URL" \
      --region "$AWS_REGION" \
      --query ARN \
      --output text)"
    unset RPC_URL
    echo "Sepolia RPC secret created successfully."
  else
    echo "No custom RPC supplied; backend will use resilient public Sepolia gateways."
  fi
else
  echo "WARNING: Could not check optional Sepolia RPC secret due to: $RPC_CHECK_ERR" >&2
  echo "Proceeding with public Sepolia RPC fallback."
fi

if [ -n "$RPC_SECRET_ARN" ]; then
  printf 'Sepolia RPC Secret ARN: %s\n' "$RPC_SECRET_ARN"
fi
```

### Step 3: Review and deploy the CloudFormation stack

Before deployment, confirm that:

- The ECR image exists in the selected AWS account and region.
- The JWT and database secrets exist in the same region as the stack.
- The CloudFormation parameters match the template.
- The IAM capabilities and permissions are understood.
- The estimated AWS charges are acceptable.

```bash
aws cloudformation validate-template \
  --template-body file://agri-chain-supply-management/aws/cloudformation-template.yaml \
  --region "$AWS_REGION"

# This command creates or updates AWS resources.
# Run it only after explicit approval of the deployment and its costs.
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
  --region "$AWS_REGION"
```

The deployment command may create or update IAM roles, an App Runner service, an S3 bucket, a CloudFront distribution, CloudWatch alarms, and related resources. The exact resources depend on the current template.

A successful template validation does not guarantee that deployment will succeed. IAM permissions, service quotas, resource names, secrets, networking, and container startup behavior can affect the outcome.

### Step 4: Extract CloudFormation outputs

After an approved deployment succeeds:

```bash
export STACK_NAME="agriculture-supply-chain-prod"

export S3_BUCKET="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendS3BucketName'].OutputValue | [0]" \
  --output text)"

export CF_DIST_ID="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" \
  --output text)"

export CF_URL="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionURL'].OutputValue | [0]" \
  --output text)"

export API_URL="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendServiceURL'].OutputValue | [0]" \
  --output text)"

printf 'S3 bucket: %s\n' "$S3_BUCKET"
printf 'CloudFront distribution ID: %s\n' "$CF_DIST_ID"
printf 'CloudFront URL: %s\n' "$CF_URL"
printf 'Backend URL: %s\n' "$API_URL"
```

### Step 5: Build and upload the frontend

Run this step after the backend URL is available and the frontend configuration has been verified.

```bash
cd agri-chain-supply-management/frontend

# Build the Vite frontend with production configuration
# - VITE_API_URL: REQUIRED. Must point to App Runner backend ending with /api.
# - VITE_CONTRACT_ADDRESS: OPTIONAL override (defaults to 0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D).
#   Ensure the address is verified on Sepolia before deploying to production.
# - VITE_CHAIN_ID: OPTIONAL override (defaults to 11155111 for Sepolia).
# - VITE_SEPOLIA_RPC_URL: OPTIONAL. Public Sepolia JSON-RPC endpoint. If omitted, frontend
#   falls back to resilient built-in public RPCs (rpc.sepolia.org, etc.).
#   SECURITY WARNING: NEVER supply private or authenticated RPC keys in frontend variables.
VITE_API_URL="${API_URL}/api" \
VITE_CONTRACT_ADDRESS="0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D" \
VITE_CHAIN_ID="11155111" \
npm run build

# Review the generated files before uploading them
test -f dist/index.html || {
  echo "Frontend build failed: dist/index.html is missing"
  exit 1
}

# Upload the generated frontend to the private S3 bucket.
# Hashed static assets (JS, CSS, images) receive long-term immutable caching.
aws s3 sync dist/ "s3://${S3_BUCKET}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable"

# index.html receives a revalidation-friendly no-cache policy so clients fetch new builds immediately
aws s3 cp dist/index.html "s3://${S3_BUCKET}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate the CloudFront edge cache to make new assets active globally
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/*"

cd ../..
```

**Security Reminder:** Vite statically embeds all `VITE_*` environment variables directly into client-side JavaScript bundles (`dist/assets/index-*.js`). Any value placed here is publicly inspectable in user browsers. Never place JWT signing keys, MongoDB credentials, or private blockchain RPC API keys in frontend build variables.

### Step 6: PowerShell Equivalents for Windows Operators

For operators deploying from native Windows PowerShell 5.1 or PowerShell 7 instead of Bash, use these equivalent commands. They implement the exact same prerequisite checks, strict error discrimination (`RepositoryNotFoundException` / `ResourceNotFoundException`), and secret protections:

```powershell
# 1. Environment & Prerequisite Verification
$env:AWS_REGION = "us-east-1"
$env:AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$env:REPO_NAME = "agri-chain-backend"

# Confirm active identity and region
aws sts get-caller-identity
aws configure get region

# 2. Safe ECR Repository Check
# Only confirmed RepositoryNotFoundException triggers creation.
# Permission, authentication, region, or network errors immediately stop execution.
$ecrCheck = aws ecr describe-repositories --repository-names $env:REPO_NAME --region $env:AWS_REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "ECR repository '$($env:REPO_NAME)' verified."
} elseif ($ecrCheck -match "RepositoryNotFoundException") {
    Write-Host "ECR repository '$($env:REPO_NAME)' not found. Creating private repository..."
    aws ecr create-repository `
      --repository-name $env:REPO_NAME `
      --region $env:AWS_REGION `
      --image-scanning-configuration scanOnPush=true `
      --encryption-configuration encryptionType=AES256
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create ECR repository."
        exit 1
    }
    Write-Host "ECR repository created successfully."
} else {
    Write-Error "CRITICAL: ECR check failed due to permission, auth, network, or region error:`n$ecrCheck"
    Write-Error "Halting procedure without attempting resource creation."
    exit 1
}

# 3. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region $env:AWS_REGION | docker login --username AWS --password-stdin "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com"

# 4. Build, tag, and publish backend container image
cd agri-chain-supply-management\backend
docker build -t "$($env:REPO_NAME):latest" .
docker tag "$($env:REPO_NAME):latest" "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com/$($env:REPO_NAME):latest"
docker push "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com/$($env:REPO_NAME):latest"
cd ..\..

# 5. Provision Secrets in AWS Secrets Manager
$env:JWT_SECRET_NAME = "agri-chain/production/jwt-secret"
$env:DB_SECRET_NAME = "agri-chain/production/mongodb-uri"

# Safe JWT Secret check
$jwtCheck = aws secretsmanager describe-secret --secret-id $env:JWT_SECRET_NAME --region $env:AWS_REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "JWT secret verified in Secrets Manager: $env:JWT_SECRET_NAME"
    $env:JWT_SECRET_ARN = (aws secretsmanager describe-secret --secret-id $env:JWT_SECRET_NAME --region $env:AWS_REGION --query ARN --output text)
} elseif ($jwtCheck -match "ResourceNotFoundException") {
    Write-Host "JWT secret '$env:JWT_SECRET_NAME' does not exist. Generating cryptographically random 256-bit secret..."
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $jwtHex = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
    $env:JWT_SECRET_ARN = (aws secretsmanager create-secret `
      --name $env:JWT_SECRET_NAME `
      --description "JWT signing secret for Agriculture Supply Chain API" `
      --secret-string "$jwtHex" `
      --region $env:AWS_REGION `
      --query ARN `
      --output text)
    $jwtHex = $null; $bytes = $null
    Write-Host "JWT secret created successfully."
} else {
    Write-Error "CRITICAL: Cannot verify JWT secret due to permission, auth, or network error:`n$jwtCheck"
    Write-Error "Halting procedure without attempting creation."
    exit 1
}

# Safe MongoDB URI Secret check
$dbCheck = aws secretsmanager describe-secret --secret-id $env:DB_SECRET_NAME --region $env:AWS_REGION 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Database secret verified in Secrets Manager: $env:DB_SECRET_NAME"
    $env:DB_SECRET_ARN = (aws secretsmanager describe-secret --secret-id $env:DB_SECRET_NAME --region $env:AWS_REGION --query ARN --output text)
} elseif ($dbCheck -match "ResourceNotFoundException") {
    Write-Host "Database secret '$env:DB_SECRET_NAME' does not exist."
    # Securely prompt operator without echoing or exposing URI in shell history
    $secUri = Read-Host -Prompt "Enter MongoDB connection URI" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secUri)
    $plainDbUri = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if (-not $plainDbUri) {
        Write-Error "MongoDB connection URI cannot be empty. Halting."
        exit 1
    }
    $env:DB_SECRET_ARN = (aws secretsmanager create-secret `
      --name $env:DB_SECRET_NAME `
      --description "MongoDB connection URI for Agriculture Supply Chain API" `
      --secret-string "$plainDbUri" `
      --region $env:AWS_REGION `
      --query ARN `
      --output text)
    $plainDbUri = $null; $secUri = $null
    Write-Host "Database secret created successfully."
} else {
    Write-Error "CRITICAL: Cannot verify database secret due to permission, auth, or network error:`n$dbCheck"
    Write-Error "Halting procedure without attempting creation."
    exit 1
}

# Print ARNs only; never print secret values
Write-Host "JWT Secret ARN: $env:JWT_SECRET_ARN"
Write-Host "Database Secret ARN: $env:DB_SECRET_ARN"

# 6. Deploy CloudFormation Stack
# Note: 0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D is the unverified operator prerequisite.
# Replace with verified Sepolia contract address if deployed separately.
aws cloudformation deploy `
  --template-file agri-chain-supply-management/aws/cloudformation-template.yaml `
  --stack-name agriculture-supply-chain-prod `
  --parameter-overrides `
    ProjectName="agri-chain" `
    Environment="production" `
    BackendImageIdentifier="$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com/$($env:REPO_NAME):latest" `
    JwtSecretArn="$env:JWT_SECRET_ARN" `
    DatabaseSecretArn="$env:DB_SECRET_ARN" `
    ContractAddress="0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D" `
  --capabilities CAPABILITY_NAMED_IAM `
  --region $env:AWS_REGION

# 7. Extract Stack Outputs
$env:S3_BUCKET = (aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --region $env:AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='FrontendS3BucketName'].OutputValue | [0]" --output text)
$env:CF_DIST_ID = (aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --region $env:AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" --output text)
$env:CF_URL = (aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --region $env:AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionURL'].OutputValue | [0]" --output text)
$env:API_URL = (aws cloudformation describe-stacks --stack-name agriculture-supply-chain-prod --region $env:AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='BackendServiceURL'].OutputValue | [0]" --output text)

Write-Host "S3 bucket: $env:S3_BUCKET"
Write-Host "CloudFront distribution ID: $env:CF_DIST_ID"
Write-Host "CloudFront URL: $env:CF_URL"
Write-Host "Backend URL: $env:API_URL"

# 8. Build and Upload Frontend
cd agri-chain-supply-management\frontend
$env:VITE_API_URL = "$($env:API_URL)/api"
$env:VITE_CONTRACT_ADDRESS = "0xB601FDccec475b61B8Bc9f3661eC4F73B7499a2D"
$env:VITE_CHAIN_ID = "11155111"
npm run build

if (-not (Test-Path "dist\index.html")) {
    Write-Error "Frontend build failed: dist\index.html missing"
    exit 1
}

aws s3 sync dist/ "s3://$($env:S3_BUCKET)/" --delete --cache-control "public, max-age=31536000, immutable"
aws s3 cp dist/index.html "s3://$($env:S3_BUCKET)/index.html" --cache-control "no-cache, no-store, must-revalidate"
aws cloudfront create-invalidation --distribution-id $env:CF_DIST_ID --paths "/*"
cd ..\..
```

---

## 3. Post-Deployment Verification and Smoke Testing

Run these checks only after an approved deployment has completed.

### 3.1 Verify backend health

```bash
curl -i "${API_URL}/api/health"
```

Expected result: a successful HTTP status and the application's documented health response. The precise response body depends on the implemented health endpoint.

### 3.2 Verify frontend delivery through CloudFront

```bash
curl -I "$CF_URL"
```

Expected result: a successful HTTP response, typically `200 OK`, with headers consistent with CloudFront delivery.

### 3.3 Verify that direct public S3 access is blocked

```bash
curl -I "https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/index.html"
```

Expected result: access is denied for an unauthenticated request when the bucket is configured for private CloudFront OAC access. A `403 Forbidden` response is expected for the intended private-bucket configuration.

### 3.4 Verify backend and infrastructure operation

- Confirm that the App Runner service reaches a healthy operational state.
- Inspect App Runner application logs for startup or database connectivity failures.
- Confirm that the application can authenticate to MongoDB using the configured secret.
- Verify that the frontend can communicate with the backend API.
- Inspect CloudWatch metrics and alarms to ensure the configured dimensions and metric data are available.
- Test the intended Ethereum Sepolia integration using the configured contract address and network.

A successful frontend response alone does not prove that backend, database, or blockchain operations work correctly.

---

## 4. Teardown, Resource Cleanup, and Cost Control

**Important:** Deleting the CloudFormation stack does not necessarily remove every resource or immediately stop every possible AWS charge. The S3 bucket in this project's template uses `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`, so it may remain after stack deletion. ECR repositories and Secrets Manager secrets are external prerequisites and may also remain.

Never run cleanup commands until the target AWS account, region, stack, bucket, and repository have been verified.

### Step 1: Identify the target resources

```bash
aws sts get-caller-identity

aws cloudformation describe-stacks \
  --stack-name agriculture-supply-chain-prod \
  --region "$AWS_REGION"

aws cloudformation list-stack-resources \
  --stack-name agriculture-supply-chain-prod \
  --region "$AWS_REGION"
```

Use the actual output values to identify the resources created for this application. Do not assume that a resource belongs to this project merely because its name looks similar.

### Step 2: Delete the CloudFormation stack

Only after confirming that the stack is the correct one and that deletion is approved:

```bash
aws cloudformation delete-stack \
  --stack-name agriculture-supply-chain-prod \
  --region "$AWS_REGION"

aws cloudformation wait stack-delete-complete \
  --stack-name agriculture-supply-chain-prod \
  --region "$AWS_REGION"
```

If deletion fails, inspect the CloudFormation stack events and resolve the reported failure before proceeding.

### Step 3: Inspect and remove retained S3 resources

After stack deletion, verify whether the S3 bucket still exists. If it does, determine whether it is safe to remove.

```bash
aws s3api head-bucket --bucket "$S3_BUCKET"
aws s3 ls "s3://${S3_BUCKET}/"
```

**Destructive operation:** The following command permanently removes objects from the selected bucket. Run it only after confirming the bucket name, contents, ownership, and approval to delete all stored data.

```bash
aws s3 rm "s3://${S3_BUCKET}/" --recursive
```

If the bucket is approved for deletion and is empty, delete it explicitly:

```bash
aws s3api delete-bucket \
  --bucket "$S3_BUCKET" \
  --region "$AWS_REGION"
```

Versioned buckets may require deletion of object versions and delete markers before the bucket can be removed. Follow the applicable AWS procedure if versioning is enabled.

### Step 4: Inspect and remove external prerequisites

If they are no longer needed, review and explicitly remove the ECR repository and application secrets created for this deployment. Confirm that no other service or environment depends on them before deletion.

Example ECR cleanup, after approval:

```bash
aws ecr delete-repository \
  --repository-name "$REPO_NAME" \
  --force \
  --region "$AWS_REGION"
```

Secrets Manager secrets may have a recovery window depending on the deletion options used. Review the consequences before deleting them.

### Step 5: Confirm remaining resources and charges

- Review CloudFormation stack deletion status and resource events.
- Check for retained S3 buckets, ECR repositories, Secrets Manager secrets, CloudWatch log groups, and any other resources that may remain.
- Review the AWS Billing and Cost Management console for ongoing or delayed charges.
- Check for separately provisioned resources such as MongoDB Atlas, NAT gateways, and other external services.

Do not claim that all billing has stopped until the remaining resources and billing state have been checked. Some charges may appear after resource deletion because of billing delays or usage already incurred.

---

## 5. Blockchain and Database Consistency Recovery Architecture

### 5.1 Dual-state transaction model

The Agriculture Supply Chain platform coordinates two independent state systems:
1. **Decentralized ledger - Ethereum Sepolia:** The blockchain state advances through a signed transaction mined by the `AgriChain` smart contract.
2. **Off-chain persistent database - MongoDB:** The application records lifecycle state using a conditional database update such as `Product.findOneAndUpdate`.
These systems do not share a single atomic transaction. A blockchain transaction can succeed even when the subsequent database update fails.

### 5.2 Recovery after a transient database failure

**Failure scenario:** An on-chain transaction succeeds on Ethereum Sepolia, but the subsequent HTTP request or MongoDB update fails because of a timeout, service restart, or database connectivity problem.

**Possible database state:** The MongoDB record may remain at the previous lifecycle status, and the transaction hash may not yet be recorded in the product history.

**Client retry recovery:** If the backend's transaction-verification logic confirms the mined transaction and the database's expected-status and duplicate-transaction conditions still hold, a retry using the same transaction hash can allow the database update to be applied safely.

The exact retry behavior depends on the implemented backend validation and conditional-update logic. A retry must not blindly repeat a blockchain action or bypass transaction verification.

### 5.3 Operational limitation

The current design does not provide an autonomous reconciliation worker that continuously discovers and repairs every mismatch between blockchain state and database state.

If a client disconnects after the blockchain transaction succeeds and never retries, the database record may remain stale until an authorized client or operator initiates recovery using the transaction hash.

### 5.4 Recommended future enhancement

A future improvement could introduce a reconciliation worker that periodically compares verified blockchain events with MongoDB lifecycle records, identifies discrepancies, and applies safe, idempotent recovery operations. Any such worker should include transaction verification, duplicate protection, authorization, observability, and error handling.

---

## 6. Final Deployment Readiness Checklist

Before an approved production deployment, verify each item:

- [ ] CloudFormation template passes local linting and AWS template validation.
- [ ] Deployment parameters and resource names match the template.
- [ ] ECR image exists and is accessible to App Runner.
- [ ] Required secrets exist and their ARNs are correct.
- [ ] IAM permissions follow least-privilege principles.
- [ ] MongoDB connectivity, TLS, authentication, and network restrictions are verified.
- [ ] Frontend environment variables match the application implementation.
- [ ] CloudWatch metric dimensions and alarm behavior have been verified.
- [ ] Cleanup procedures account for retained resources and external prerequisites.
- [ ] Expected costs and possible ongoing charges have been reviewed.
- [ ] Explicit authorization has been obtained before creating or modifying AWS resources.

**Current project status:** Local CloudFormation linting has passed. Live AWS deployment, runtime smoke tests, and billing verification remain pending.

**End of guide.**
