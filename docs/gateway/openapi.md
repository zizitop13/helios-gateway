---
title: Gateway API Reference
---

# Gateway API Reference

The gateway exposes public runtime endpoints and admin endpoints used by the admin console and automation.

## OpenAPI Specification

- [Download or view the raw OpenAPI YAML](./openapi.yaml)

The raw YAML remains available for code generation, API clients, and tooling that expects an OpenAPI document.

## Common Endpoints

| Endpoint | Purpose |
| --- | --- |
| `/graphql` | Public federated GraphQL endpoint. |
| `/health` | Gateway health check. |
| `/admin/console` | Admin console UI when `ADMIN_CONSOLE_ENABLED=true`. |
| `/admin/config/firebase` | Firebase web configuration for the admin console. |

Use the raw specification for the full route and schema details.

The Users frontend also documents `GET /admin/api/users` (listing, filtering,
pagination) and `GET /admin/api/users/{uid}/roles`. These operations are **TODO /
not implemented** and carry `x-implementation-status: not-implemented`. Existing
`GET /admin/api/roles` and `POST /admin/api/users/roles` supply role hints and
complete role replacement, including removal. See [Users](../admin-console/users.html)
for the preview mode and integration switch.
