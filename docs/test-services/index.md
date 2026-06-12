---
title: Test Services
---

# Test Services

`testing/services` contains local and demo subgraph services used to validate Helios Gateway behavior during development and integration testing.

Use these services with [file discovery](../gateway/federation-discovery.html#yaml-file) for the quickest local setup.

## Pet Shop Subgraphs

The sample graph contains three static Node.js GraphQL subgraph services:

| Service | Port | Endpoint |
| --- | --- | --- |
| `pets-service` | `5001` | `http://localhost:5001/graphql` |
| `orders-service` | `5002` | `http://localhost:5002/graphql` |
| `customers-service` | `5003` | `http://localhost:5003/graphql` |

The repository also includes a `broken-service` fixture used by health and failure-path tests.

## Run Locally

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

Then configure the gateway with:

```bash
DISCOVERY_MODE=file
DISCOVERY_FILE_PATH=../testing/services/subgraphs.local.yaml
```

See [Gateway Setup](../gateway/local-development.html#get-started-with-test-services) for the full local tutorial.

## RBAC Directives

Each service schema uses the RBAC annotation format from `gateway/src/rbac/RBACManager.ts`:

```graphql
directive @requiresRole(roles: [String!]!, match: RoleMatch = ANY) on FIELD_DEFINITION | OBJECT
directive @allowAnonymous on FIELD_DEFINITION | OBJECT
```

- `@requiresRole` restricts a field or type to callers with the required roles. The gateway enforces this; subgraph resolvers do not check roles.
- `@allowAnonymous` marks a field or type as publicly accessible without authentication.

## Local Discovery File

The file `testing/services/subgraphs.local.yaml` lists the sample subgraphs:

```yaml
services:
  - subgraph:
      name: pets-service
      port: 5001
  - subgraph:
      name: orders-service
      port: 5002
  - subgraph:
      name: customers-service
      port: 5003
```
