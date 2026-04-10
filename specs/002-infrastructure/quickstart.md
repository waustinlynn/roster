# Quickstart: Infrastructure Provisioning (002)

This guide walks through deploying the full Roster AWS infrastructure from scratch.

## Prerequisites

| Requirement | Check |
|-------------|-------|
| AWS credentials configured | `aws sts get-caller-identity` returns your account ID |
| Terraform ≥ 1.6 | `terraform version` |
| AWS CLI ≥ 2.x | `aws --version` |
| Bootstrap complete | S3 state bucket + DynamoDB lock table created (see below) |

## Step 1: Bootstrap Remote State (one-time, manual)

The Terraform state backend (S3 bucket + DynamoDB table) must be created once before
`terraform init` can run. See [`infra/bootstrap/README.md`](../../infra/bootstrap/README.md)
for exact commands.

## Step 2: Decide Image Tags

All image tags must be pinned — no `latest` is permitted.

| Image | Variable | Example |
|-------|----------|---------|
| API (ECR) | `api_image_tag` | `1.0.0` |
| Redpanda (Docker Hub) | `redpanda_image_tag` | `v23.3.1` |

The API image must be built and pushed to ECR before the ECS service can start:

```bash
# Get the ECR URI from Terraform outputs (after first apply or plan)
ECR_URI=$(terraform -chdir=infra/environments/dev output -raw ecr_api_repo)

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URI

# Build and push
docker build -t $ECR_URI:1.0.0 api/
docker push $ECR_URI:1.0.0
```

## Step 3: Deploy Dev Environment

```bash
cd infra/environments/dev

terraform init

# Review the plan (~40 resources)
terraform plan \
  -var="api_image_tag=1.0.0" \
  -var="redpanda_image_tag=v23.3.1" \
  -out=dev.tfplan

# Apply
terraform apply dev.tfplan
```

Expected output after a successful apply:

```
api_url          = "roster-dev-alb-xxxxxxxxx.us-east-1.elb.amazonaws.com"
ui_url           = "dxxxxxxxxxxxx.cloudfront.net"
ecr_api_repo     = "123456789.dkr.ecr.us-east-1.amazonaws.com/roster-api"
redpanda_endpoint = "redpanda.roster-dev.local:9092"
```

## Step 4: Verify

### API health check

```bash
# Self-signed cert — use -k
curl -k https://<api_url>/health
# Expected: {"status":"Healthy"} with HTTP 200
```

> Before the API's aggregate replay completes, the ALB returns 503. Wait ~30 seconds
> for the ECS health check to pass.

### UI

```bash
curl https://<ui_url>/index.html
# Expected: HTTP 200 with the SPA HTML shell
```

### Redpanda

```bash
# Exec into the API task and probe Redpanda
aws ecs execute-command \
  --cluster roster-dev \
  --task <task-id> \
  --container api \
  --interactive \
  --command "bash"

# Inside the container:
curl -s redpanda.roster-dev.local:9644/v1/brokers
```

### No NAT gateway

```bash
aws ec2 describe-nat-gateways \
  --filter "Name=tag:env,Values=dev" \
  --query "NatGateways[].State"
# Expected: [] (empty — no NAT gateways)
```

## Step 5: Deploy UI

After the CloudFront distribution is created:

```bash
npm run build --prefix ui

aws s3 sync ui/dist/ s3://roster-ui-dev/

aws cloudfront create-invalidation \
  --distribution-id <cloudfront_distribution_id> \
  --paths "/*"
```

## Step 6: Idempotency Check

```bash
# Should show: No changes. Your infrastructure matches the configuration.
terraform plan \
  -var="api_image_tag=1.0.0" \
  -var="redpanda_image_tag=v23.3.1"
```

## Tear Down

```bash
terraform destroy \
  -var="api_image_tag=1.0.0" \
  -var="redpanda_image_tag=v23.3.1"
```

> The S3 state bucket and DynamoDB table are **not** managed by Terraform and will not
> be destroyed. Delete them manually if needed.

## Prod Environment

```bash
cd infra/environments/prod
terraform init
terraform plan \
  -var="api_image_tag=1.0.0" \
  -var="redpanda_image_tag=v23.3.1"
terraform apply ...
```

Prod differences: Container Insights enabled, 30-day log retention, 30-day Glacier
transition, larger Redpanda task (2048 CPU / 4096 MB).

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| API ECS task stuck in `PENDING` | ECR image tag not found | Push the image to ECR first |
| API health check `503` | Aggregate replay in progress | Wait up to 60s (startPeriod=30s, 6 retries) |
| Redpanda task not starting | EFS mount target not ready | EFS can take 60–90s to become available |
| `terraform init` fails | State bucket not found | Complete bootstrap step first |
| ECR pull fails in API task | VPC endpoint misconfigured | Verify `ecr.api` + `ecr.dkr` endpoints are active |
