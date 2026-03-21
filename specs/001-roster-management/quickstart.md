# Quickstart: Youth Sports Roster Management

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| .NET SDK | 10.x | API build & test |
| Node.js | 22+ | UI build |
| Docker + Docker Compose | 24+ | Local Redpanda + API dev |
| Terraform | ≥ 1.6 | Infrastructure provisioning |
| AWS CLI | v2 | ECR push, infrastructure auth |
| `gh` CLI | optional | PR workflow |

---

## Local Development

### 1. Start Redpanda locally

```bash
# From repository root
docker compose up -d redpanda

# Verify Redpanda is healthy
docker compose exec redpanda rpk cluster health
```

The `docker-compose.yml` at the repo root starts a single-node Redpanda instance
and creates the `roster-events` topic automatically on first run.

### 2. Run the API

```bash
cd api

# Restore dependencies
dotnet restore

# Run with hot-reload (uses local Redpanda via appsettings.Development.json)
dotnet watch run --project Roster.Api
```

The API starts on `https://localhost:5001`. It replays events from Redpanda before
marking itself healthy. On a fresh (empty) topic this takes < 1 second.

Swagger UI: `https://localhost:5001/swagger`

### 3. Run the UI

```bash
cd ui

# Install dependencies
npm install

# Generate the API client from the running API's OpenAPI spec
npm run generate-client   # calls orval; reads http://localhost:5001/swagger/v1/swagger.json

# Start dev server with hot-reload
npm run dev
```

UI runs on `http://localhost:5173`.

> **Note**: Run `npm run generate-client` whenever API endpoints change to keep the
> generated client in sync.

---

## Running Tests

### API unit tests

```bash
cd api
dotnet test --filter "Category!=Integration"
```

### API integration tests (requires Docker)

```bash
cd api
dotnet test --filter "Category=Integration"
# Testcontainers pulls the Redpanda image automatically on first run
```

### UI tests

```bash
cd ui
npm test
```

### Full suite

```bash
# From repo root
dotnet test api/Roster.sln && npm test --prefix ui
```

---

## Infrastructure — First-Time Setup

### Configure AWS credentials

```bash
aws configure   # or use SSO / environment variables
```

### Create Terraform remote state bucket (one-time, manual)

```bash
aws s3 mb s3://roster-terraform-state-{your-suffix} --region us-east-1
aws dynamodb create-table \
  --table-name roster-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Update `infra/environments/dev/main.tf` backend block with the bucket name.

### Provision dev environment

```bash
cd infra/environments/dev

terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Terraform outputs include:
- `api_url` — ALB DNS name for the API
- `ui_url` — CloudFront distribution URL
- `ecr_api_repo` — ECR repository URI for the API image
- `ecr_redpanda_not_needed` — Redpanda image is pulled from Docker Hub

---

## Build & Deploy

### Build and push the API image

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin {account-id}.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -t roster-api ./api

# Tag and push
docker tag roster-api:latest {ecr_api_repo}:latest
docker push {ecr_api_repo}:latest

# Force ECS to pull the new image
aws ecs update-service \
  --cluster roster-{env} \
  --service roster-api \
  --force-new-deployment
```

### Build and deploy the UI

```bash
cd ui

# Point orval at the deployed API URL
API_URL=https://api.roster.{domain} npm run generate-client

# Build static assets
npm run build

# Sync to S3
aws s3 sync dist/ s3://roster-ui-{env}/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id {cloudfront_id} \
  --paths "/*"
```

---

## Startup & Health Check

The API container goes through this sequence before accepting traffic:

1. `AggregateReplayService` (IHostedService) starts.
2. Connects to Redpanda and consumes all events from `roster-events` starting at
   offset 0 (earliest).
3. Applies each event to `InMemoryStore` to rebuild all aggregates.
4. Sets the `_isReady` flag to `true`.
5. `AggregateReadinessCheck` begins returning `Healthy`.
6. ECS ALB health check (`GET /health`) receives `200 OK` and marks the task healthy.
7. The ALB routes traffic to the task.

**ECS health check settings** (configured in Terraform):
```hcl
health_check = {
  command     = ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
  interval    = 10
  timeout     = 5
  retries     = 6          # allows up to 60s for replay before marking unhealthy
  startPeriod = 30         # grace period for container startup
}
```

---

## Environment Variables

### API (`Roster.Api`)

| Variable | Description | Default (dev) |
|---|---|---|
| `Redpanda__BootstrapServers` | Redpanda broker address | `localhost:9092` |
| `Redpanda__Topic` | Event topic name | `roster-events` |
| `ASPNETCORE_ENVIRONMENT` | `Development` or `Production` | `Development` |
| `ASPNETCORE_URLS` | Listener URL | `http://+:8080` |

### UI

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the deployed API |

---

## Validation Checklist

After deploying to dev, verify:

- [ ] `GET https://api.roster.{domain}/health` returns `200 {"status":"Healthy"}`
- [ ] `POST /teams` creates a team and returns a one-time access secret
- [ ] Swagger UI loads at `https://api.roster.{domain}/swagger`
- [ ] Re-visiting the UI auto-loads the team (localStorage secret)
- [ ] Adding a player and refreshing shows the player persisted (event replayed)
- [ ] Creating a game, assigning positions, and locking it works end-to-end
- [ ] Balance matrix shows correct inning counts after a locked game
- [ ] Restarting the API container replays events and restores all data
