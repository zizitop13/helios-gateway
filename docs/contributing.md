---
title: Contributing
nav_section: contributing
---

# Contributing

Use this page when changing the gateway, admin console, sample services, or
end-to-end tests.

## Contributor Workflow

Use this flow when changing the gateway, admin console, or tests.

### Build and Run

```bash
cd gateway
npm install
npm run build
npm test
```

```bash
cd ../admin-console
npm install
npm run build
npm run lint
```

### Gateway Scripts

- `npm run dev-gateway`: start gateway with `gateway/.env.local`.
- `npm run build`: compile TypeScript.
- `npm start`: run compiled server from `dist/main.js`.
- `npm test`: run Jest tests.
- `npm run lint`: lint gateway sources.

## Main Code Areas

- `gateway/src/main.ts`: gateway entry point.
- `gateway/src/app/bootstrap/startGateway.ts`: startup orchestration.
- `gateway/src/gateway.ts`: Apollo Gateway and server wiring.
- `gateway/src/discovery`: Cloud Run, Docker, and file discovery providers.
- `gateway/src/auth`: authentication managers.
- `gateway/src/rbac`: schema directive parsing and role enforcement.
- `gateway/src/admin`: admin API and admin console serving.
- `gateway/src/routes`: HTTP route registration.
- `gateway/src/utils/config.ts`: environment variable parsing.
- `admin-console/src`: React admin UI.
- `testing/services`: sample Pet Shop subgraphs.
- `testing/e2e`: Playwright end-to-end suite.

## Testing

For gateway unit tests:

```bash
cd gateway
npm test
```

For end-to-end tests:

```bash
cd testing/e2e
npm install
npm test
```

Use [E2E Test Organization](./testing/e2e.html) for the test surface layout and required environment values.

## E2E Test Organization

The E2E docs describe the Playwright suite, support clients, feature files, and
admin-console page objects.

[Open E2E test organization](./testing/e2e.html)

## Admin Console Development

The admin-console docs describe the UI routes and development workflow for the
browser admin experience.

[Open admin console development](./admin-console/)
