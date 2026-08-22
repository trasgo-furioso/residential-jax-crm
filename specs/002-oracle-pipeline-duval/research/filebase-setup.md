# Filebase Setup Runbook

Setup guide for Filebase S3-compatible IPFS/IPNS access for the Oracle Pipeline (Duval County).

---

## 1. Account Setup

1. Go to [https://filebase.com](https://filebase.com) and click **Try for Free**.
2. Enter your email address and a password (temporary/disposable emails are not accepted).
3. Accept the terms of service and submit the registration form.
4. Open the verification email and click the confirmation link.
5. Sign in to the Filebase web console at [https://console.filebase.com](https://console.filebase.com).

## 2. Get API Credentials

1. In the Filebase console, navigate to **Access Keys** in the left sidebar.
2. If no key pair exists yet, click **Create Access Key** (or the equivalent button).
3. Copy both the **Access Key** and **Secret Key** immediately and store them securely.
4. The secret key is only shown once at creation time -- treat it like a password.

Connection settings for all S3 clients:

| Setting   | Value                        |
|-----------|------------------------------|
| Endpoint  | `https://s3.filebase.com`    |
| Region    | `us-east-1`                  |
| Signature | AWS Signature Version 4      |

> Filebase does NOT support AWS Signature Version 2.

## 3. Create IPFS Buckets

Create two IPFS-backed buckets in the Filebase console:

### Bucket 1: `elephant-oracle-open-data-duval`

Purpose: Published property JSON artifacts (per-parcel enriched data).

1. In the console, go to **Buckets** and click **Create Bucket**.
2. Select **IPFS** as the storage network.
3. Enter the name: `elephant-oracle-open-data-duval`
4. Confirm creation.

### Bucket 2: `elephant-oracle-query-table-duval`

Purpose: Published Parquet query tables (aggregated analytical datasets).

1. Click **Create Bucket** again.
2. Select **IPFS** as the storage network.
3. Enter the name: `elephant-oracle-query-table-duval`
4. Confirm creation.

> Note: The free tier only allows 1 bucket. You will need a paid plan (Starter at $5.99/mo) for 2+ buckets. Alternatively, use a single bucket with path-based separation (e.g., `open-data/` and `query-table/` prefixes) on the free tier.

## 4. Create IPNS Names

Create two IPNS names so consumers can resolve a stable address that always points to the latest published CID.

### IPNS Name 1: `oracle-open-data-duval`

1. In the console, go to **IPNS** and click **Create IPNS Name**.
2. Enter the label: `oracle-open-data-duval`
3. Associate it with the `elephant-oracle-open-data-duval` bucket (or a specific CID within it).
4. Confirm creation.

### IPNS Name 2: `oracle-query-table-duval`

1. Click **Create IPNS Name** again.
2. Enter the label: `oracle-query-table-duval`
3. Associate it with the `elephant-oracle-query-table-duval` bucket.
4. Confirm creation.

> Note: The free tier only allows 1 IPNS name. A paid plan is required for 2 names.

## 5. Configure .env

Add the following environment variables to your `.env` file in the delivery repo. Do NOT commit this file.

```bash
# Filebase S3-compatible IPFS credentials
FILEBASE_ACCESS_KEY=<from dashboard Access Keys page>
FILEBASE_SECRET_KEY=<from dashboard Access Keys page>

# Bucket names
FILEBASE_BUCKET_OPEN_DATA=elephant-oracle-open-data-duval
FILEBASE_BUCKET_QUERY_TABLE=elephant-oracle-query-table-duval

# S3 connection (used by AWS SDK / boto3)
FILEBASE_ENDPOINT=https://s3.filebase.com
FILEBASE_REGION=us-east-1
```

## 6. Verify Setup

Install the AWS CLI if not already available, then configure a named profile:

```bash
aws configure --profile filebase
# Access Key ID: <FILEBASE_ACCESS_KEY>
# Secret Access Key: <FILEBASE_SECRET_KEY>
# Default region: us-east-1
# Default output format: json
```

Verify bucket access:

```bash
# List all buckets
aws --endpoint-url https://s3.filebase.com --profile filebase s3 ls

# List contents of the open-data bucket
aws --endpoint-url https://s3.filebase.com --profile filebase s3 ls s3://elephant-oracle-open-data-duval/

# List contents of the query-table bucket
aws --endpoint-url https://s3.filebase.com --profile filebase s3 ls s3://elephant-oracle-query-table-duval/

# Upload a test file
echo '{"test": true}' > /tmp/test-filebase.json
aws --endpoint-url https://s3.filebase.com --profile filebase s3 cp /tmp/test-filebase.json s3://elephant-oracle-open-data-duval/test.json

# Check the uploaded object's IPFS CID (returned in x-amz-meta-cid header)
aws --endpoint-url https://s3.filebase.com --profile filebase s3api head-object \
  --bucket elephant-oracle-open-data-duval \
  --key test.json

# Clean up test file
aws --endpoint-url https://s3.filebase.com --profile filebase s3 rm s3://elephant-oracle-open-data-duval/test.json
rm /tmp/test-filebase.json
```

## 7. IPNS Verification

Verify IPNS names are configured and resolvable:

```bash
# Build the auth token (Basic auth, base64-encoded)
TOKEN=$(echo -n "$FILEBASE_ACCESS_KEY:$FILEBASE_SECRET_KEY" | base64)

# List all IPNS names
curl -s -H "Authorization: Bearer $TOKEN" https://api.filebase.io/v1/names | jq .

# Get a specific IPNS name's details
curl -s -H "Authorization: Bearer $TOKEN" https://api.filebase.io/v1/names/oracle-open-data-duval | jq .

# Resolve an IPNS name via a public gateway (replace <ipns-key> with the IPNS key hash from above)
# curl https://ipfs.filebase.io/ipns/<ipns-key>
```

## 8. Free Tier Notes

As of 2025, the Filebase free plan includes:

| Resource              | Free Tier Limit        |
|-----------------------|------------------------|
| Storage               | 5 GB (pooled)          |
| Buckets               | 1                      |
| IPNS names            | 1                      |
| Pinned files          | 500                    |
| IPFS egress           | 1 GB / month           |
| Bandwidth             | 5 GB / month           |
| Class A operations    | 1,000,000 / month      |
| Class B operations    | 10,000,000 / month     |
| Request rate limit    | 500 requests / second  |

**Key implications for this project:**

- The free tier is NOT sufficient for our setup (we need 2 buckets and 2 IPNS names).
- The **Starter plan** ($5.99/month) or higher is required, which provides additional buckets and IPNS names.
- Alternatively, consolidate into a single bucket with path prefixes (`open-data/` and `query-table/`) and a single IPNS name if staying on the free tier for development.
- Exceeding storage or bandwidth caps returns `403 Forbidden` errors (not overage charges).
- For production workloads, monitor usage via the Filebase billing dashboard.

---

**References:**
- [Filebase S3-compatible API docs](https://docs.filebase.com/api-documentation/s3-compatible-api)
- [Filebase pricing](https://filebase.com/pricing/)
- [Filebase IPNS docs](https://docs.filebase.com/sites/sites)
- [Filebase FAQ](https://docs.filebase.com/getting-started/faq)
