# Federation Discovery Setup

The gateway discovers subgraphs once at startup (no runtime refresh). If you add or change subgraphs, redeploy or restart the gateway.

## Cloud Run Services

Gateway in `DISCOVERY_MODE=cloudrun` discovers only Cloud Run services with:

- label `subgraph=true` (required)
- label `subgraph_name=<name>` or `subgraph-name=<name>` (optional; if missing, Cloud Run service name is used)

Gateway env vars for Cloud Run discovery:

- `DISCOVERY_MODE=cloudrun`
- `GCP_PROJECT_ID=<project-id>` (or `FIREBASE_PROJECT_ID` as fallback)
- `GCP_REGION=<region>` (defaults to `us-central1`)
- `ENABLE_CLOUD_RUN_IAM_AUTH=true|false` (optional)
- `GRAPH_NAME=<graph-scope>` (optional)
- `GRAPH_LABEL_KEY=graph` (optional, default `graph`)

Cloud Run note: there is no `subgraph.port` label for Cloud Run discovery. The gateway uses the Cloud Run service URL and appends `/graphql`.

Example:

```bash
gcloud run services update users-service \
  --region=europe-west3 \
  --update-labels=subgraph=true,graph=pet-shop
```

If gateway has `GRAPH_NAME=pet-shop`, it will only discover subgraphs where `graph=pet-shop`.

## Docker Containers

Gateway in `DISCOVERY_MODE=docker` discovers only running containers with:

- label `subgraph=true` (required)
- label `subgraph.name=<name>` or `subgraph_name=<name>` (required)
- label `subgraph.port=<port>` or `subgraph_port=<port>` (optional; fallback is first exposed port, then `4000`)

Gateway env vars for Docker discovery:

- `DISCOVERY_MODE=docker`
- `DOCKER_SOCKET_PATH=/var/run/docker.sock` (default)
- `GRAPH_NAME=<graph-scope>` (optional)
- `GRAPH_LABEL_KEY=graph` (optional, default `graph`)

`docker-compose` example labels:

```yaml
labels:
  subgraph: "true"
  subgraph.name: "users"
  subgraph.port: "4001"
  graph: "pet-shop"
```

## YAML File

Gateway in `DISCOVERY_MODE=file` loads subgraphs from a YAML file once at startup.

Gateway env vars for file discovery:

- `DISCOVERY_MODE=file`
- `DISCOVERY_FILE_PATH=<absolute-or-relative-path-to-yaml>`
- `GRAPH_NAME=<graph-scope>` (optional)
- `GRAPH_LABEL_KEY=graph` (optional, default `graph`)

YAML uses the same terms as other discovery modes (`services`, `subgraph`, and optional `graph`):

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

The gateway converts each item to `http://<name>:<port>/graphql`.

Optional top-level `graph` section is also supported:

```yaml
services:
  - subgraph:
      name: users
      port: 4001
graph:
  - subgraph:
      name: reviews
      port: 4004
    graph: pet-shop
```

