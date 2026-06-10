---
title: Gateway Setup and Contributor Workflow
nav_section: contributing
---

# Gateway Setup and Contributor Workflow

Use this page when you want to run Helios Gateway locally, deploy it as an operator, or work on the codebase as a contributor.

## Using the Gateway as a Client

Helios Gateway is the front door for a federated GraphQL platform. Clients call one GraphQL endpoint, and the gateway composes and routes operations to discovered subgraphs.

Local endpoints:

- GraphQL: [http://localhost:4000/graphql](http://localhost:4000/graphql)
- Admin Console UI: [http://localhost:4000/admin/console](http://localhost:4000/admin/console)
- Health: [http://localhost:4000/health](http://localhost:4000/health)

The gateway can discover subgraphs from:

- Google Cloud Run services labeled as subgraphs.
- Local Docker containers labeled as subgraphs.
- A YAML file that lists subgraph names and ports.

## Get Started with Test Services

The fastest local tutorial is to run the sample Pet Shop subgraphs from `testing/services`, then start the gateway with file discovery.

### 1. Install Gateway Dependencies

```bash
cd gateway
npm install
```

### 2. Install Admin Console Dependencies

```bash
cd ../admin-console
npm install
npm run build
```

The gateway serves the built admin console from `/admin/console`.

### 3. Start the Sample Subgraphs

Open one terminal per service:

```bash
cd testing/services/pets-service
npm install
npm run dev-pets-service
```

```bash
cd testing/services/orders-service
npm install
npm run dev-orders-service
```

```bash
cd testing/services/customers-service
npm install
npm run dev-customers-service
```

The sample services expose:

- `http://localhost:5001/graphql`
- `http://localhost:5002/graphql`
- `http://localhost:5003/graphql`

### 4. Configure Local File Discovery

Create or update `gateway/.env.local`:

```bash
PORT=4000
DISCOVERY_MODE=file
DISCOVERY_FILE_PATH=../testing/services/subgraphs.local.yaml
ADMIN_CONSOLE_ENABLED=true
ENABLE_APOLLO_SANDBOX=true
ENABLE_SCHEMA_REFRESH=true
SCHEMA_REFRESH_INTERVAL_SECONDS=60
```

### 5. Start the Gateway

```bash
cd gateway
npm run dev-gateway
```

Open [http://localhost:4000/graphql](http://localhost:4000/graphql) and run a small introspection or Pet Shop query.

## Install on a Local Machine

For local use outside the repository, build the gateway package and run the compiled server:

```bash
cd gateway
npm install
npm run build
npm start
```

For container-based local use:

```bash
docker build -t helios-gateway .
docker run --rm -p 4000:4000 --env-file gateway/.env.local helios-gateway
```

## Install from Docker

Use Docker Hub:

```bash
docker pull zizitop13/helios-gateway:latest
```

```bash
docker run --rm \
  --name helios-gateway \
  -p 4000:4000 \
  -e DISCOVERY_MODE=file \
  -e DISCOVERY_FILE_PATH=/app/subgraphs.local.yaml \
  zizitop13/helios-gateway:latest
```

Use GitHub Container Registry:

```bash
docker pull ghcr.io/zizitop13/helios-gateway:latest
```

```bash
docker run --rm \
  --name helios-gateway \
  -p 4000:4000 \
  -e DISCOVERY_MODE=file \
  -e DISCOVERY_FILE_PATH=/app/subgraphs.local.yaml \
  ghcr.io/zizitop13/helios-gateway:latest
```

To pass a full local environment file:

```bash
docker run --rm \
  --name helios-gateway \
  -p 4000:4000 \
  --env-file gateway/.env.local \
  ghcr.io/zizitop13/helios-gateway:latest
```

Use [Environment Variables](./environment-variables.html) to choose the discovery mode and authentication settings.

## Common Google Cloud Setup

These steps are shared by Cloud Run deployments for the gateway and sample subgraphs.

### 1. Select a Project and Region

```bash
gcloud config set project <project-id>
gcloud config set run/region <region>
```

Example region:

```bash
gcloud config set run/region europe-west3
```

### 2. Enable Required APIs

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

If Firebase authentication is used, create or connect a Firebase project and make sure the gateway has the Firebase project id configured.

### 3. Authenticate Local Tooling

```bash
gcloud auth login
gcloud auth application-default login
```

Application Default Credentials are useful when running the gateway locally while it needs to call Cloud Run APIs.

### 4. Label Cloud Run Subgraphs

Cloud Run discovery requires subgraph labels:

```bash
gcloud run services update pets-service \
  --region=<region> \
  --update-labels=subgraph=true,subgraph_name=pets,graph=pet-shop
```

When `GRAPH_NAME=pet-shop`, the gateway discovers only services with `graph=pet-shop`.

## Deploy on Google Cloud Run

Build and deploy the root Docker image:

```bash
gcloud builds submit --tag gcr.io/<project-id>/helios-gateway
```

```bash
gcloud run deploy helios-gateway \
  --image gcr.io/<project-id>/helios-gateway \
  --region <region> \
  --allow-unauthenticated \
  --set-env-vars DISCOVERY_MODE=cloudrun,GCP_PROJECT_ID=<project-id>,GCP_REGION=<region>,ADMIN_CONSOLE_ENABLED=true
```

If downstream subgraphs require Cloud Run IAM authentication, also set:

```bash
ENABLE_CLOUD_RUN_IAM_AUTH=true
```

Then grant the gateway service account permission to invoke the subgraph services.

## Contributor Workflow

Use this flow when changing the gateway, admin console, or tests.

### Build and Run

```bash
cd gateway
npm install
npm run build
npm test
```

```bash
cd ../admin-console
npm install
npm run build
npm run lint
```

### Gateway Scripts

- `npm run dev-gateway`: start gateway with `gateway/.env.local`.
- `npm run build`: compile TypeScript.
- `npm start`: run compiled server from `dist/main.js`.
- `npm test`: run Jest tests.
- `npm run lint`: lint gateway sources.

### Main Code Areas

- `gateway/src/main.ts`: gateway entry point.
- `gateway/src/app/bootstrap/startGateway.ts`: startup orchestration.
- `gateway/src/gateway.ts`: Apollo Gateway and server wiring.
- `gateway/src/discovery`: Cloud Run, Docker, and file discovery providers.
- `gateway/src/auth`: authentication managers.
- `gateway/src/rbac`: schema directive parsing and role enforcement.
- `gateway/src/admin`: admin API and admin console serving.
- `gateway/src/routes`: HTTP route registration.
- `gateway/src/utils/config.ts`: environment variable parsing.
- `admin-console/src`: React admin UI.
- `testing/services`: sample Pet Shop subgraphs.
- `testing/e2e`: Playwright end-to-end suite.

## Testing

For gateway unit tests:

```bash
cd gateway
npm test
```

For end-to-end tests:

```bash
cd testing/e2e
npm install
npm test
```

Use [E2E Test Organization](../testing/e2e.html) for the test surface layout and required environment values.
