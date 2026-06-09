---
title: Environment Variables
---

# Environment Variables

Helios Gateway configuration is intentionally grouped around how the gateway is used. Start with the core runtime variables, then add the discovery, authentication, admin console, and schema refresh settings that match your deployment.

Boolean flags are string based. Set them to exactly `true` to enable the behavior.

## Core Runtime

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `4000` | HTTP port for the gateway server. |
| `DISCOVERY_MODE` | No | `cloudrun` | Subgraph discovery mode: `cloudrun`, `docker`, or `file`. |
| `GRAPH_NAME` | No | - | Optional graph scope name. When set, the gateway discovers only subgraphs with a matching label or file value. |
| `GRAPH_LABEL_KEY` | No | `graph` | Label key used with `GRAPH_NAME` filtering, for example `graph=pet-shop`. |

## Google Cloud Run Discovery

Use these variables when `DISCOVERY_MODE=cloudrun`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GCP_PROJECT_ID` | Cloud Run mode | - | Google Cloud project scanned for Cloud Run services. If missing, `FIREBASE_PROJECT_ID` is used as fallback. |
| `GCP_REGION` | No | `us-central1` | Cloud Run region to scan for services. |
| `ENABLE_CLOUD_RUN_IAM_AUTH` | No | `false` | If `true`, the gateway attaches identity tokens when calling downstream Cloud Run services. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local Google auth | - | Path to Google ADC JSON file for local Cloud Run API access or IAM token flows. |

Cloud Run services must be labeled as subgraphs. See [Federation Discovery](./federation-discovery.html#cloud-run-services).

## Docker Discovery

Use these variables when `DISCOVERY_MODE=docker`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DOCKER_SOCKET_PATH` | Docker mode | `/var/run/docker.sock` | Docker socket path used for Docker discovery. |

Docker containers must include subgraph labels. See [Federation Discovery](./federation-discovery.html#docker-containers).

## File Discovery

Use these variables when `DISCOVERY_MODE=file`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCOVERY_FILE_PATH` | File mode | - | Path to the YAML file used for file discovery. |

The local tutorial uses:

```bash
DISCOVERY_MODE=file
DISCOVERY_FILE_PATH=../testing/services/subgraphs.local.yaml
```

See [Federation Discovery](./federation-discovery.html#yaml-file).

## Firebase Authentication

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Recommended | - | Firebase project id for auth and fallback project id for Cloud Run discovery. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | No | - | Path to Firebase service account JSON used by Firebase Admin SDK. |
| `SUPER_ADMIN_ID` | No | - | UID or email that bypasses `admin` role checks for admin API access. |

## Admin Console

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ADMIN_CONSOLE_ENABLED` | No | `false` | Enables serving the admin UI route at `/admin/console`. |
| `ADMIN_CONSOLE_FIREBASE_API_KEY` | Admin console login | - | Firebase Web API key returned to the admin UI from `/admin/config/firebase`. |
| `ADMIN_CONSOLE_FIREBASE_AUTH_DOMAIN` | Admin console login | - | Firebase Auth domain for the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_PROJECT_ID` | Admin console login | - | Firebase project id used by the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_APP_ID` | Admin console login | - | Firebase app id for the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_STORAGE_BUCKET` | No | - | Optional Firebase storage bucket returned to the admin UI when your project uses Storage. |
| `ADMIN_CONSOLE_FIREBASE_MESSAGING_SENDER_ID` | No | - | Optional Firebase messaging sender id for the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_MEASUREMENT_ID` | No | - | Optional Firebase Analytics measurement id for the admin UI web app configuration. |

When `ADMIN_CONSOLE_ENABLED=true`, the gateway exposes `/admin/config/firebase` and returns configured `ADMIN_CONSOLE_FIREBASE_*` values to the browser.

## GraphQL UI and Schema Refresh

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ENABLE_APOLLO_SANDBOX` | No | `false` | Forces embedded Apollo Sandbox to be served at `/graphql`, including production-style deployments such as Cloud Run. |
| `ENABLE_SCHEMA_REFRESH` | No | `true` | Enables periodic rediscovery and recomposition without restarting Apollo Server. |
| `SCHEMA_REFRESH_INTERVAL_SECONDS` | No | `60` | Refresh interval in seconds when `ENABLE_SCHEMA_REFRESH=true`. |

## Common Profiles

### Local File Discovery with Test Services

```bash
PORT=4000
DISCOVERY_MODE=file
DISCOVERY_FILE_PATH=../testing/services/subgraphs.local.yaml
ADMIN_CONSOLE_ENABLED=true
ENABLE_APOLLO_SANDBOX=true
```

### Cloud Run Gateway

```bash
PORT=4000
DISCOVERY_MODE=cloudrun
GCP_PROJECT_ID=<project-id>
GCP_REGION=<region>
ADMIN_CONSOLE_ENABLED=true
```

### Cloud Run Gateway with IAM-Protected Subgraphs

```bash
DISCOVERY_MODE=cloudrun
GCP_PROJECT_ID=<project-id>
GCP_REGION=<region>
ENABLE_CLOUD_RUN_IAM_AUTH=true
```
