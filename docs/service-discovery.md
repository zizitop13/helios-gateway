---
title: Service Discovery
nav_section: home
---

# Service Discovery

Helios Gateway discovers subgraphs from one of three sources: Google Cloud Run,
Docker containers, or a YAML file. The selected discovery mode produces the same
internal service list, so the gateway can compose and refresh the federated
schema in a consistent way.

## Core Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCOVERY_MODE` | No | `cloudrun` | Discovery source: `cloudrun`, `docker`, or `file`. |
| `GRAPH_NAME` | No | - | Optional graph scope. When set, only subgraphs with the matching graph label or YAML graph value are included. |
| `GRAPH_LABEL_KEY` | No | `graph` | Label key used with `GRAPH_NAME`, for example `graph=pet-shop`. |
| `ENABLE_SCHEMA_REFRESH` | No | `true` | Periodically rediscovers subgraphs and recomposes the schema. |
| `SCHEMA_REFRESH_INTERVAL_SECONDS` | No | `60` | Refresh interval when schema refresh is enabled. |

## Cloud Run

Use Cloud Run discovery when subgraphs are deployed as Cloud Run services.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCOVERY_MODE` | Yes | - | Set to `cloudrun`. |
| `GCP_PROJECT_ID` | Cloud Run mode | `FIREBASE_PROJECT_ID` | Google Cloud project scanned for Cloud Run services. |
| `GCP_REGION` | No | `us-central1` | Cloud Run region scanned for services. |
| `ENABLE_CLOUD_RUN_IAM_AUTH` | No | `false` | Sends identity tokens when calling IAM-protected Cloud Run subgraphs. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local Google auth | - | Path to Application Default Credentials JSON for local Cloud Run API access. |

Cloud Run subgraph services must have this label:

```bash
subgraph=true
```

Optional labels:

```bash
subgraph_name=orders-service
graph=pet-shop
```

The gateway uses the service URL returned by Cloud Run and calls `/graphql` on
that service.

## Docker

Use Docker discovery for local container demos and compose-based development.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCOVERY_MODE` | Yes | - | Set to `docker`. |
| `DOCKER_SOCKET_PATH` | Docker mode | `/var/run/docker.sock` | Docker socket used to list running containers and inspect network data. |

Docker subgraph containers must have these labels:

```yaml
labels:
  subgraph: "true"
  subgraph.name: "orders-service"
  subgraph.port: "5002"
  graph: "pet-shop"
```

The gateway resolves compose services by service name when Docker Compose
metadata is present, for example `http://orders-service:5002/graphql`.

## File-Based Discovery

Use file discovery for deterministic local development and tests.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCOVERY_MODE` | Yes | - | Set to `file`. |
| `DISCOVERY_FILE_PATH` | File mode | - | Path to the YAML file containing subgraph definitions. |
| `DISCOVERY_FILE_DEFAULT_HOST` | No | Subgraph name | Optional host used when a YAML entry only provides name and port. |

Example:

```yaml
services:
  - subgraph:
      name: pets-service
      port: 5001
    graph: pet-shop
  - subgraph:
      name: orders-service
      port: 5002
    graph: pet-shop
```

The repository includes a local example at `testing/services/subgraphs.local.yaml`.
