# Bootstrap — Remote State Setup

This is a **one-time manual step** that must be completed before running `terraform init` in
any environment. It creates the S3 bucket and DynamoDB table that Terraform uses to store
state and prevent concurrent modifications.

> These two resources are intentionally **not** managed by Terraform because Terraform
> requires them to exist before it can run. Delete them manually only when permanently
> decommissioning all environments.

---

## Prerequisites

- AWS CLI installed and configured with credentials for the target account
- `jq` installed (optional, for JSON output parsing)

Verify credentials:

```bash
aws sts get-caller-identity
```

---

## Step 1 — Create the S3 State Bucket

Choose a globally unique bucket name. Convention: `roster-terraform-state-{account_id_suffix}`.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="roster-terraform-state-${ACCOUNT_ID}"
REGION="us-east-1"

# Create bucket (us-east-1 does NOT use --create-bucket-configuration)
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$REGION"

# Enable versioning (required — allows state recovery)
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# Block all public access
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "State bucket: $BUCKET_NAME"
```

---

## Step 2 — Create the DynamoDB Lock Table

```bash
aws dynamodb create-table \
  --table-name roster-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

echo "Lock table: roster-terraform-locks"
```

---

## Step 3 — Update Backend Configuration

Edit `infra/environments/dev/versions.tf` (and prod) to set the bucket name:

```hcl
terraform {
  backend "s3" {
    bucket         = "roster-terraform-state-367553824651"  # ← your bucket name
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "roster-terraform-locks"
    encrypt        = true
  }
}
```

---

## Step 4 — Verify

```bash
aws s3 ls s3://$BUCKET_NAME
aws dynamodb describe-table --table-name roster-terraform-locks --query "Table.TableStatus"
```

Both should succeed before running `terraform init`.

---

## What Was Created

| Resource | Name | Purpose |
|----------|------|---------|
| S3 Bucket | `roster-terraform-state-{account_id}` | Stores `.tfstate` files for all environments |
| DynamoDB Table | `roster-terraform-locks` | Prevents concurrent `terraform apply` runs |

These resources are billed at minimal cost (S3 standard storage + DynamoDB on-demand reads/writes).
