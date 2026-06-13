---
title: Docker Demo
nav_section: home
---

# Docker Demo

This compose file starts Helios Gateway, the demo subgraphs, and a Firebase Auth
emulator. The gateway uses Docker discovery, so each subgraph service has the
labels required for federation discovery.

```yaml
services:
  firebase-auth-emulator:
    image: node:20-bookworm
    working_dir: /workspace
    environment:
      SUPER_ADMIN_ID: admin@example.com
    command: >
      sh -lc "apt-get update &&
      apt-get install -y --no-install-recommends openjdk-17-jre-headless &&
      npm install -g firebase-tools &&
      printf '{\"emulators\":{\"auth\":{\"host\":\"0.0.0.0\",\"port\":9099}},\"projects\":{\"default\":\"helios-demo\"}}' > firebase.json &&
      firebase emulators:start --only auth --project helios-demo"
    ports:
      - "9099:9099"

  helios-gateway:
    image: ghcr.io/zizitop13/helios-gateway:latest
    ports:
      - "4000:4000"
    environment:
      PORT: "4000"
      DISCOVERY_MODE: docker
      DOCKER_SOCKET_PATH: /var/run/docker.sock
      GRAPH_NAME: pet-shop
      GRAPH_LABEL_KEY: graph
      FIREBASE_PROJECT_ID: helios-demo
      FIREBASE_AUTH_EMULATOR_HOST: firebase-auth-emulator:9099
      SUPER_ADMIN_ID: admin@example.com
      ADMIN_CONSOLE_ENABLED: "true"
      ADMIN_CONSOLE_FIREBASE_API_KEY: demo-api-key
      ADMIN_CONSOLE_FIREBASE_AUTH_DOMAIN: localhost
      ADMIN_CONSOLE_FIREBASE_PROJECT_ID: helios-demo
      ADMIN_CONSOLE_FIREBASE_APP_ID: 1:123456789:web:helios-demo
      ENABLE_APOLLO_SANDBOX: "true"
      ENABLE_SCHEMA_REFRESH: "true"
      SCHEMA_REFRESH_INTERVAL_SECONDS: "30"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - firebase-auth-emulator
      - orders-service
      - customers-service
      - pets-service
      - broken-service

  orders-service:
    image: ghcr.io/zizitop13/helios-gateway-orders-service:latest
    environment:
      PORT: "5002"
    labels:
      subgraph: "true"
      subgraph.name: orders-service
      subgraph.port: "5002"
      graph: pet-shop

  customers-service:
    image: ghcr.io/zizitop13/helios-gateway-customers-service:latest
    environment:
      PORT: "5003"
    labels:
      subgraph: "true"
      subgraph.name: customers-service
      subgraph.port: "5003"
      graph: pet-shop

  pets-service:
    image: ghcr.io/zizitop13/helios-gateway-pets-service:latest
    environment:
      PORT: "5001"
    labels:
      subgraph: "true"
      subgraph.name: pets-service
      subgraph.port: "5001"
      graph: pet-shop

  broken-service:
    image: ghcr.io/zizitop13/helios-gateway-broken-service:latest
    environment:
      PORT: "5004"
    labels:
      subgraph: "true"
      subgraph.name: broken-service
      subgraph.port: "5004"
      graph: pet-shop
```

After the stack starts, open:

- GraphQL endpoint: [http://localhost:4000/graphql](http://localhost:4000/graphql)
- Admin Console: [http://localhost:4000/admin/console/](http://localhost:4000/admin/console/)
- Firebase Auth emulator UI is not included in this minimal compose file; the auth emulator API listens on [http://localhost:9099](http://localhost:9099).

## Gateway Variables Used

| Variable | Value | Purpose |
| --- | --- | --- |
| `DISCOVERY_MODE` | `docker` | Reads running Docker containers and discovers labeled subgraphs. |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | Gives the gateway access to Docker metadata. |
| `GRAPH_NAME` | `pet-shop` | Includes only subgraphs labeled `graph=pet-shop`. |
| `FIREBASE_PROJECT_ID` | `helios-demo` | Initializes Firebase Admin SDK for the demo project. |
| `FIREBASE_AUTH_EMULATOR_HOST` | `firebase-auth-emulator:9099` | Points Firebase Admin SDK to the Auth emulator from inside the compose network. |
| `SUPER_ADMIN_ID` | `admin@example.com` | Allows the demo admin user to access admin API routes without an `admin` custom claim. |
| `ADMIN_CONSOLE_ENABLED` | `true` | Serves the Admin Console from the gateway. |
| `ENABLE_APOLLO_SANDBOX` | `true` | Serves Apollo Sandbox at `/graphql`. |

## Subgraph Labels Used

| Label | Example | Purpose |
| --- | --- | --- |
| `subgraph` | `true` | Marks the container as a federated subgraph. |
| `subgraph.name` | `orders-service` | Names the subgraph in the composed schema. |
| `subgraph.port` | `5002` | Tells the gateway which container port serves GraphQL. |
| `graph` | `pet-shop` | Matches the gateway's `GRAPH_NAME` scope. |
