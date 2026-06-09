# Test Services (Pet Shop)

`test-services` contains local/demo subgraph services used to validate Apollo Federation gateway behavior during development and integration testing.

Use these services with the gateway discovery modes described in [Federation Discovery](../gateway/federation-discovery.md).



This folder contains 3 Node.js GraphQL subgraph services with static data only.

- `pets-service` (port `5001`)
- `orders-service` (port `5002`)
- `customers-service` (port `5003`)

Each service schema uses the RBAC annotation format from `gateway/src/rbac/RBACManager.ts`:

```graphql
directive @requiresRole(roles: [String!]!, match: RoleMatch = ANY) on FIELD_DEFINITION | OBJECT
directive @allowAnonymous on FIELD_DEFINITION | OBJECT
```

- `@requiresRole` — restricts a field or type to callers with the required roles. The gateway enforces this; subgraph resolvers do not check roles.
- `@allowAnonymous` — marks a field or type as publicly accessible without authentication.

## Run locally

Open 3 terminals one per service:

```bash
cd testing/services/pets-service
npm install
npm run dev
```

```bash
cd testing/services/orders-service
npm install
npm run dev
```

```bash
cd testing/services/customers-service
npm install
npm run dev
```

## GraphQL endpoints

- http://localhost:5001/graphql
- http://localhost:5002/graphql
- http://localhost:5003/graphql

