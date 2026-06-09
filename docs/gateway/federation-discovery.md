---
title: Federation Discovery
---

# Federation Discovery

Helios Gateway discovers subgraphs, composes the federated schema, and exposes one GraphQL endpoint at `/graphql`.

Discovery can run from Google Cloud Run, local Docker containers, or a YAML file. If schema refresh is enabled, the gateway periodically rediscoveres and recomposes subgraphs without a full process restart.

## Cloud Run Services

Use `DISCOVERY_MODE=cloudrun` when subgraphs are deployed as Cloud Run services.

Required service label:

- `subgraph=true`

Optional labels:

- `subgraph_name=<name>` or `subgraph-name=<name>`: subgraph name. If missing, the Cloud Run service name is used.
- `<GRAPH_LABEL_KEY>=<GRAPH_NAME>`: graph scoping label, commonly `graph=pet-shop`.

Gateway variables:

```bash
DISCOVERY_MODE=cloudrun
GCP_PROJECT_ID=<project-id>
GCP_REGION=<region>
```

Optional:

```bash
ENABLE_CLOUD_RUN_IAM_AUTH=true
GRAPH_NAME=pet-shop
GRAPH_LABEL_KEY=graph
```

Cloud Run discovery uses each service URL and appends `/graphql`.

Label a service:

```bash
gcloud run services update users-service \
  --region=europe-west3 \
  --update-labels=subgraph=true,subgraph_name=users,graph=pet-shop
```

If the gateway has `GRAPH_NAME=pet-shop`, it discovers only services where `graph=pet-shop`.

## Docker Containers

Use `DISCOVERY_MODE=docker` when subgraphs are running as local Docker containers.

Required labels:

- `subgraph=true`
- `subgraph.name=<name>` or `subgraph_name=<name>`

Optional labels:

- `subgraph.port=<port>` or `subgraph_port=<port>`. If missing, the gateway uses the first exposed port, then falls back to `4000`.
- `<GRAPH_LABEL_KEY>=<GRAPH_NAME>` for graph scoping.

Gateway variables:

```bash
DISCOVERY_MODE=docker
DOCKER_SOCKET_PATH=/var/run/docker.sock
```

`docker-compose` example:

```yaml
labels:
  subgraph: "true"
  subgraph.name: "users"
  subgraph.port: "4001"
  graph: "pet-shop"
```

## YAML File

Use `DISCOVERY_MODE=file` for local development, demos, and deterministic test environments.

Gateway variables:

```bash
DISCOVERY_MODE=file
DISCOVERY_FILE_PATH=<absolute-or-relative-path-to-yaml>
```

Example:

```yaml
services:
  - subgraph:
      name: users
      port: 4001
  - subgraph:
      name: orders
      port: 4002
    graph: pet-shop
```

The gateway converts each item to:

```text
http://<name>:<port>/graphql
```

The sample repository file is `testing/services/subgraphs.local.yaml`.

## Graph Scoping

Graph scoping lets one environment host multiple federated graphs.

```bash
GRAPH_NAME=pet-shop
GRAPH_LABEL_KEY=graph
```

With those values, Cloud Run services, Docker containers, or YAML entries must include `graph=pet-shop` to be discovered.
