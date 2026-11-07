---
title: Admin Console
nav_section: home
---

# Admin Console

The Admin Console is the browser UI for operating Helios Gateway. It is served
by the gateway at:

```text
http://localhost:4000/admin/console/
```

The console requires Firebase authentication. After login, the layout provides
persistent navigation for gateway operations, user information, role assignment,
and GraphQL Sandbox access.

## Navigation

The authenticated console shell includes:

- Header with logo, graph scope when configured, theme toggle, and a Profile menu containing My profile and Logout.
- Sidebar links for Home, Subgraphs, Status, Users, and GraphQL Sandbox.
- Main content area for the selected page.

## Login

Route: `/admin/console/login`

The login page signs an operator into the Admin Console with Firebase
Authentication. Once the user is authenticated, the gateway can verify the
session and allow access to the protected console views.

![Admin console login page](./admin-console/screenshots/login.png)

## Home

Route: `/admin/console/`

The home page is the console dashboard. It gives operators a quick starting
point for common tasks such as inspecting subgraphs, checking gateway status,
reviewing user information, managing roles, and opening GraphQL Sandbox.

![Admin console home page](./admin-console/screenshots/home.png)

## Subgraphs

Route: `/admin/console/subgraphs`

The subgraphs page lists discovered services from the active discovery provider.
Operators can inspect service names, URLs, labels, graph scope, and health
state, which makes it the main page for confirming that federation discovery is
working as expected.

![Admin console subgraphs page](./admin-console/screenshots/subgraphs.png)

## Gateway Status

Route: `/admin/console/status`

The status page shows the runtime state of the gateway, including uptime,
discovery mode, configured graph scope, and the number of services currently
known to the gateway.

![Admin console gateway status page](./admin-console/screenshots/status.png)

## User Information

Route: `/admin/console/profile` via **Profile → My profile** in the top-right corner.

The user information page shows the current Firebase user identity and token
details. It helps operators verify which UID, email, roles, and claims are being
used for admin-console authorization.

![Admin console user information page](./admin-console/screenshots/user-info.png)

## Users and Role Management

Route: `/admin/console/users`

The [Users page](./admin-console/users.html) lists and searches Firebase users.
Select an account to view assigned roles, add or remove tags, and save the full
role set. Users without email addresses are supported through UID selection.

The current frontend-only version displays labeled sample data and keeps all
changes in memory. Its missing user-list and role-read API contracts are marked
TODO in OpenAPI. The existing assignment API is reused by the gateway adapter
once those reads are implemented. Old `/user` and `/roles` bookmarks redirect to
Profile and Users respectively.

## GraphQL Sandbox Health Check

Route: Sidebar action

Before opening GraphQL Sandbox, the console can check discovered subgraphs and
surface any failing services. This helps operators avoid opening a graph session
against a partially unavailable federation.

![Admin console GraphQL Sandbox health check in progress](./admin-console/screenshots/sandbox-health-modal.png)

When the health check completes, the modal summarizes the state of the discovered
subgraphs and lets the operator continue to Sandbox when the environment is
ready.

![Admin console GraphQL Sandbox completed health check](./admin-console/screenshots/sandbox-health-modal-complete.png)
