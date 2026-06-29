---
title: Authentication and RBAC
nav_section: home
---

# Authentication and RBAC

Helios Gateway uses Firebase Authentication for identity and role claims, then
enforces role-based access control while executing operations through the
federated graph.

Clients send Firebase ID tokens in the `Authorization` header:

```text
Authorization: Bearer <firebase-id-token>
```

Browser clients can also exchange a Firebase ID token for an HTTP-only gateway
session cookie. This is useful for the Admin Console, embedded GraphQL Sandbox,
and browser apps that prefer cookie-based requests over storing bearer tokens in
application code.

## Firebase Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Recommended | - | Firebase project id used by Firebase Admin SDK. Also used as the Cloud Run project fallback. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | No | - | Path to a Firebase service account JSON file. If omitted, Firebase Admin uses default credentials. |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local emulator | - | Firebase Auth emulator host, for example `firebase-auth-emulator:9099` in Docker Compose. |
| `SUPER_ADMIN_ID` | No | - | UID or email that bypasses `admin` role checks for admin API access. |
| `TOKEN_EXPIRES_IN_DAYS` | No | `5` | Lifetime, in days, for gateway session cookies created from Firebase ID tokens. |

In the Docker demo, `SUPER_ADMIN_ID=admin@example.com` is set on the gateway and
the Firebase Auth emulator service so both containers share the same demo admin
identity.

## Admin Console Firebase Variables

When the Admin Console is served by the gateway, the browser needs Firebase web
app configuration from `/admin/config/firebase`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ADMIN_CONSOLE_ENABLED` | No | `false` | Serves the admin UI at `/admin/console`. |
| `ADMIN_CONSOLE_FIREBASE_API_KEY` | Admin console login | - | Firebase Web API key. |
| `ADMIN_CONSOLE_FIREBASE_AUTH_DOMAIN` | Admin console login | - | Firebase Auth domain for the browser app. |
| `ADMIN_CONSOLE_FIREBASE_PROJECT_ID` | Admin console login | - | Firebase project id for the browser app. |
| `ADMIN_CONSOLE_FIREBASE_APP_ID` | Admin console login | - | Firebase app id. |
| `ADMIN_CONSOLE_FIREBASE_STORAGE_BUCKET` | No | - | Optional Firebase storage bucket. |
| `ADMIN_CONSOLE_FIREBASE_MESSAGING_SENDER_ID` | No | - | Optional Firebase messaging sender id. |
| `ADMIN_CONSOLE_FIREBASE_MEASUREMENT_ID` | No | - | Optional Firebase Analytics measurement id. |

## Cookie-Based Browser Sessions

The gateway supports a browser session flow that starts with Firebase sign-in
and ends with a provider-backed Firebase session cookie. The browser still signs
in with Firebase first, but the gateway stores the long-lived credential as an
HTTP-only cookie named `apollo_playground_token`.

The session flow is:

1. Request a CSRF token:

   ```http
   GET /csrfToken
   ```

   The response returns JSON like `{"csrfToken":"..."}` and sets a readable
   `apollo_csrf_token` cookie. The browser must send both the cookie and the
   token value back on state-changing session requests.

2. Exchange a Firebase ID token for a gateway session:

   ```http
   POST /sessionLogin
   Content-Type: application/json
   X-CSRF-Token: <csrf-token>

   {
     "idToken": "<firebase-id-token>"
   }
   ```

   The gateway verifies the Firebase ID token, creates a Firebase session cookie
   through the Firebase Admin SDK, and stores that session cookie in
   `apollo_playground_token`. The raw ID token is not stored in the cookie.

3. Call GraphQL with cookies:

   ```http
   POST /graphql
   Content-Type: application/json
   X-CSRF-Token: <csrf-token>
   ```

   Requests that authenticate with `apollo_playground_token` must also include a
   matching CSRF token, either in the `X-CSRF-Token` header or the `csrfToken`
   query parameter. The query parameter is used by browser tools such as the
   embedded GraphQL Sandbox.

4. Clear the gateway session:

   ```http
   POST /sessionLogout
   X-CSRF-Token: <csrf-token>
   ```

   Logout clears the `apollo_playground_token` cookie after validating the CSRF
   token.

Cookie options are selected by environment. In local development, cookies use
`SameSite=Lax` and are not marked `Secure`. In production, cookies use
`SameSite=None` and `Secure`. The session cookie is HTTP-only; the CSRF cookie is
readable by browser JavaScript so clients can echo it in the CSRF header.

The gateway accepts both authentication styles on protected routes. If an
`Authorization: Bearer <firebase-id-token>` header is present and verifies
successfully, that user is used. If the bearer token is absent or invalid and an
`apollo_playground_token` cookie is present, the gateway verifies the Firebase
session cookie and uses that user context instead. Admin API routes apply the
same fallback and still require the `admin` role or `SUPER_ADMIN_ID`.

## Downstream Cloud Run IAM

Firebase authentication protects the client-to-gateway request. In Cloud Run
deployments, you can also protect the gateway-to-subgraph hop with Cloud Run IAM
by making downstream subgraph services private and enabling identity-token calls
from the gateway.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ENABLE_CLOUD_RUN_IAM_AUTH` | No | `false` | When `true`, the gateway attaches Google identity tokens while calling downstream Cloud Run subgraphs. |

Set this only when subgraphs require Cloud Run IAM authentication:

```bash
ENABLE_CLOUD_RUN_IAM_AUTH=true
```

When enabled, the gateway obtains a Google identity token for each subgraph URL
and sends it as:

```text
Authorization: Bearer <google-identity-token>
```

The token is used for subgraph schema introspection, RBAC policy preload,
regular GraphQL execution, and admin-console subgraph health checks. The token
audience is the subgraph service origin, for example
`https://orders-service-abc123-ew.a.run.app`.

The gateway runtime identity must be allowed to invoke every protected subgraph.
For Cloud Run, grant the gateway service account `roles/run.invoker` on each
private subgraph service. If the gateway runs outside Cloud Run during local
testing, configure Google Application Default Credentials, for example with
`GOOGLE_APPLICATION_CREDENTIALS`.

Leave `ENABLE_CLOUD_RUN_IAM_AUTH=false` when subgraphs are public, local Docker
services, or file-discovered HTTP services that do not accept Google identity
tokens.

## Authorization Model

The gateway extracts roles from Firebase custom claims. It supports common
claim shapes such as:

```json
{
  "roles": ["admin", "support"]
}
```

```json
{
  "role": "admin"
}
```

Those roles are used by the gateway RBAC layer and by admin API checks. The
Admin Console role management page can assign custom-claim roles to Firebase
users when the signed-in user has the required privileges.

## RBAC Schema Directives

Subgraphs declare gateway authorization rules in their SDL with two directives:

```graphql
enum RoleMatch {
  ANY
  ALL
}

directive @requiresRole(
  roles: [String!]!
  match: RoleMatch = ANY
) on FIELD_DEFINITION | OBJECT

directive @allowAnonymous on FIELD_DEFINITION | OBJECT
```

The gateway reads these annotations from discovered subgraph schemas and
enforces them before the operation is sent to subgraph resolvers. Resolvers do
not need to re-check the same roles unless the service has its own independent
authorization model.

By default, every selected field requires an authenticated Firebase user. Add
`@allowAnonymous` only to fields or object types that should be callable without
an `Authorization` header.

### `@requiresRole`

Use `@requiresRole` when a field or object type should be visible only to users
with specific Firebase custom-claim roles.

```graphql
type Query {
  orders: [Order!]! @requiresRole(roles: ["staff", "support"])
  financeReport: FinanceReport! @requiresRole(roles: ["finance", "admin"], match: ALL)
}
```

With the default `match: ANY`, a caller only needs one of the listed roles. With
`match: ALL`, the caller must have every listed role. Role values are matched
against the normalized role strings extracted from the Firebase token.

You can also annotate an object type to protect every selection on that type:

```graphql
type AdminAuditEntry @requiresRole(roles: ["admin"]) {
  id: ID!
  action: String!
  actorEmail: String!
}

type Query {
  auditLog: [AdminAuditEntry!]!
}
```

In this example, an authenticated user without the `admin` role receives a
`FORBIDDEN` GraphQL error when selecting fields from `AdminAuditEntry`.

### `@allowAnonymous`

Use `@allowAnonymous` for public fields that should be accessible before login,
such as status, catalog, or read-only marketing data.

```graphql
type Query {
  health: String! @allowAnonymous
  featuredProducts: [Product!]! @allowAnonymous
  me: UserProfile!
}
```

Anonymous callers can query `health` and `featuredProducts`. The `me` field
still requires authentication because it has no anonymous policy.

The directive can also be placed on an object type when all selections on that
type should be public:

```graphql
type PublicProduct @allowAnonymous {
  id: ID!
  name: String!
  price: String!
}

type Query {
  product(id: ID!): PublicProduct @allowAnonymous
}
```

Keep `@allowAnonymous` narrow. If a public field returns a type that also exposes
private fields, protect those private fields with `@requiresRole` or split the
public shape into a separate object type.

## Example Policy Mix

```graphql
type Query {
  catalog: [Product!]! @allowAnonymous
  order(id: ID!): Order @requiresRole(roles: ["staff", "support"])
  adminMetrics: AdminMetrics! @requiresRole(roles: ["admin"])
}

type Mutation {
  createOrder(input: CreateOrderInput!): Order! @requiresRole(roles: ["staff"])
  refundOrder(id: ID!): Order! @requiresRole(roles: ["support", "admin"], match: ANY)
}

type AdminMetrics @requiresRole(roles: ["admin"]) {
  activeUsers: Int!
  failedPayments: Int!
}
```

This schema allows unauthenticated catalog reads, requires either `staff` or
`support` for order lookup, restricts order creation to `staff`, and limits
admin metrics to `admin` users.
