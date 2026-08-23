# Residential Property Acquisition CRM — Build, Deploy & Run
# Usage: make <target>

# ── Configuration ──────────────────────────────────────────────────────────────
IPNS_KEY := k51qzi5uqu5dggq0h9xylfc0kr0kpw7i4zcacnfrymz9sjv7mpeze4femaujcz
API_URL := https://42trwtmqqe.execute-api.us-east-2.amazonaws.com
DB_URL := postgresql://neondb_owner:npg_ZO8JUqnHLep5@ep-red-sky-axw1khsx.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require
WEBHOOK_SECRET := 406f09cb3cd287b2787afa7f6e903752fa61a07740f6e89781f006b51279f659
AMPLIFY_APP_ID := d2nys96ft16522
AMPLIFY_BRANCH := feature/003-residential-jax-crm
REGION := us-east-2

# ── Local Development ─────────────────────────────────────────────────────────

.PHONY: install
install: ## Install all dependencies
	pnpm install

.PHONY: dev
dev: ## Run frontend dev server
	NEXT_PUBLIC_API_URL=$(API_URL) \
	NEXT_PUBLIC_IPNS_QUERY_TABLE=$(IPNS_KEY) \
	NEXT_PUBLIC_IPNS_OPEN_DATA=$(IPNS_KEY) \
	pnpm --filter @crm/web dev

.PHONY: dev-api
dev-api: ## Run API locally (requires sam-cli or similar)
	DATABASE_URL="$(DB_URL)" \
	WEBHOOK_SECRET=$(WEBHOOK_SECRET) \
	IPNS_OPEN_DATA_KEY=$(IPNS_KEY) \
	IPNS_QUERY_TABLE_KEY=$(IPNS_KEY) \
	pnpm --filter @crm/api dev

# ── Build ──────────────────────────────────────────────────────────────────────

.PHONY: build
build: ## Build all packages
	pnpm turbo run build

.PHONY: build-web
build-web: ## Build frontend with env vars
	NEXT_PUBLIC_API_URL=$(API_URL) \
	NEXT_PUBLIC_IPNS_QUERY_TABLE=$(IPNS_KEY) \
	NEXT_PUBLIC_IPNS_OPEN_DATA=$(IPNS_KEY) \
	pnpm --filter @crm/web build

.PHONY: build-api
build-api: ## Build API
	pnpm --filter @crm/api build

# ── Test & Lint ────────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run all tests
	pnpm turbo run test

.PHONY: typecheck
typecheck: ## Run typecheck across all packages
	pnpm turbo run typecheck

.PHONY: lint
lint: ## Run linter
	pnpm turbo run lint

# ── Deploy ─────────────────────────────────────────────────────────────────────

.PHONY: deploy-api
deploy-api: ## Deploy CDK backend to us-east-2
	DATABASE_URL="$(DB_URL)" \
	WEBHOOK_SECRET=$(WEBHOOK_SECRET) \
	IPNS_OPEN_DATA_KEY=$(IPNS_KEY) \
	IPNS_QUERY_TABLE_KEY=$(IPNS_KEY) \
	ANTHROPIC_API_KEY=$${ANTHROPIC_API_KEY:-placeholder} \
	pnpm --filter @crm/api exec cdk deploy --require-approval never

.PHONY: deploy-web
deploy-web: ## Trigger Amplify frontend build
	aws amplify start-job \
		--app-id $(AMPLIFY_APP_ID) \
		--branch-name $(AMPLIFY_BRANCH) \
		--job-type RELEASE \
		--region $(REGION)

.PHONY: deploy
deploy: deploy-api deploy-web ## Deploy both backend and frontend

.PHONY: deploy-status
deploy-status: ## Check Amplify build status
	@aws amplify list-jobs \
		--app-id $(AMPLIFY_APP_ID) \
		--branch-name $(AMPLIFY_BRANCH) \
		--region $(REGION) \
		--query "jobSummaries[0:3].[jobId,status,commitId]" \
		--output table

# ── Database ───────────────────────────────────────────────────────────────────

.PHONY: db-push
db-push: ## Push Drizzle schema to Neon
	DATABASE_URL="$(DB_URL)" pnpm --filter @crm/api exec drizzle-kit push

.PHONY: db-studio
db-studio: ## Open Drizzle Studio
	DATABASE_URL="$(DB_URL)" pnpm --filter @crm/api exec drizzle-kit studio

# ── Standalone Server ──────────────────────────────────────────────────────────

.PHONY: serve
serve: build-web ## Build and run standalone server locally
	NEXT_PUBLIC_API_URL=$(API_URL) \
	NEXT_PUBLIC_IPNS_QUERY_TABLE=$(IPNS_KEY) \
	NEXT_PUBLIC_IPNS_OPEN_DATA=$(IPNS_KEY) \
	PORT=3000 \
	node apps/web/.next/standalone/apps/web/server.js

# ── Verification ───────────────────────────────────────────────────────────────

.PHONY: verify-api
verify-api: ## Check API endpoint responds
	@curl -sI $(API_URL) | head -5

.PHONY: verify-web
verify-web: ## Check frontend responds
	@curl -sI https://$(AMPLIFY_BRANCH).$(AMPLIFY_APP_ID).amplifyapp.com/ | head -5

.PHONY: verify-ipns
verify-ipns: ## Check IPNS resolution and query_table_cid
	@curl -s "https://ipfs.filebase.io/ipns/$(IPNS_KEY)" | python3 -m json.tool

.PHONY: verify-webhook
verify-webhook: ## Test webhook endpoint (no signature — should return 401)
	@curl -s -X POST $(API_URL)/webhook/pipeline \
		-H "Content-Type: application/json" \
		-d '{"test":true}' | python3 -m json.tool || echo "Expected 401 or error"

.PHONY: verify
verify: verify-api verify-web verify-ipns ## Run all verification checks

# ── Help ───────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
