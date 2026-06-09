---
title: E2E Test Organization
---

# E2E Test Organization

The Playwright e2e suite lives in `testing/e2e`. It covers three product surfaces:

- `admin-console`: browser tests for the admin UI, written with `playwright-bdd`.
- `gateway`: API tests for the public GraphQL endpoint.
- `admin-api`: API tests for gateway management endpoints.

Organize tests by product surface first, then by behavior. Do not name a broad suite after one concern such as RBAC when it also covers queries, mutations, subscriptions, health, or management behavior.

## Current Layout

```text
testing/e2e/
  package.json
  playwright.config.js
  src/
    fixtures.js
    admin-api/
      subgraphs-health.spec.js
    gateway/
      graphql/
        access-control.spec.js
        mutation-operations.spec.js
        subscription-operations.spec.js
    support/
      auth/
        firebase.auth.js
        index.auth.js
      clients/
        admin-api.client.js
        graphql.client.js
        subscription.client.js
      env.js
      roles.js
    console/
      features/
        admin-login.feature
        admin-navigation.feature
        admin-subgraphs.feature
      pages/
        layout.page.js
        login.page.js
        subgraphs.page.js
      steps/
        login.steps.js
        navigation.steps.js
        subgraphs.steps.js
```

Generated BDD specs are written under `testing/e2e/src/.features-gen` and should not be treated as source files.

## Playwright Projects

`playwright.config.js` defines one project per surface:

- `admin-console` runs generated BDD specs for console features.
- `gateway` runs `src/gateway/**/*.spec.js` against the GraphQL endpoint.
- `admin-api` runs `src/admin-api/**/*.spec.js` against the admin API.

Keep project names surface-oriented. If provider-specific auth coverage is added, use provider-qualified project names:

- `gateway:firebase`
- `gateway:cognito`
- `gateway:keycloak`
- `admin-api:firebase`
- `admin-api:cognito`
- `admin-api:keycloak`

The same behavioral specs should run across providers through auth adapters.

## Test Commands

Run commands from `testing/e2e`:

```sh
npm run test:gateway
npm run test:admin-api
npm run test:admin-ui
npm test
```

Use the narrowest surface command that matches the change, then run `npm test` when the change crosses gateway, admin API, and admin console behavior.

## Configuration

The suite loads `.env.local` from `testing/e2e` and also reads process environment variables. API tests require the GraphQL endpoint, Firebase web API key, and role credentials used by the current Firebase sign-in helper:

```text
GRAPHQL_ENDPOINT
FIREBASE_WEB_API_KEY
E2E_VIEWER_EMAIL
E2E_VIEWER_PASSWORD
E2E_STAFF_EMAIL
E2E_STAFF_PASSWORD
E2E_SUPPORT_EMAIL
E2E_SUPPORT_PASSWORD
E2E_ADMIN_FINANCE_EMAIL
E2E_ADMIN_FINANCE_PASSWORD
```

Optional variables used by the suite include:

```text
ADMIN_CONSOLE_URL
ADMIN_CONSOLE_BASE_PATH
GATEWAY_GRAPHQL_ENDPOINT
E2E_BROKEN_SUBGRAPH_NAME
```

## API Tests

API specs share helpers from `src/support`:

- environment validation
- role credential lookup
- Firebase password sign-in
- GraphQL requests
- admin API requests
- subscription schema helpers
- GraphQL error-code extraction

Gateway specs should focus on GraphQL behavior. Admin API specs should focus on management endpoints such as subgraph health and subgraph management. Keep request setup in helpers so assertions stay close to product behavior.

## Admin Console Tests

Console tests use feature files, step definitions, page objects, and shared fixtures:

- Put user-facing scenarios in `src/console/features`.
- Put browser interaction details in `src/console/steps`.
- Put reusable selectors and page actions in `src/console/pages`.
- Add shared page fixtures in `src/fixtures.js`.

Feature files are compiled by `bddgen` before Playwright runs.

## Auth Adapter Direction

Provider-specific auth should be hidden behind adapters. Specs should ask an auth adapter for a role token and should not call Firebase, Amazon Cognito, or Keycloak directly.

Use this shape in specs:

```js
const token = await auth.signInAs(request, 'viewer');
```

Provider-neutral auth and clients live under:

```text
testing/e2e/src/support/auth/firebase.auth.js
testing/e2e/src/support/auth/index.auth.js
testing/e2e/src/support/clients/admin-api.client.js
testing/e2e/src/support/clients/graphql.client.js
testing/e2e/src/support/clients/subscription.client.js
testing/e2e/src/support/env.js
testing/e2e/src/support/roles.js
```

Add provider-specific auth adapters such as `cognito.auth.js` and `keycloak.auth.js` beside the Firebase adapter when those providers are wired into the suite.

## Naming Guidance

Prefer behavior-specific spec names under the surface they exercise:

```text
testing/e2e/src/gateway/graphql/access-control.spec.js
testing/e2e/src/gateway/graphql/mutation-operations.spec.js
testing/e2e/src/gateway/graphql/subscription-operations.spec.js
testing/e2e/src/admin-api/access-control.spec.js
testing/e2e/src/admin-api/subgraphs-health.spec.js
testing/e2e/src/admin-api/subgraphs-management.spec.js
```

This keeps access-control tests separate from operation, health, and management tests while preserving the product-surface boundary.
