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

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| Login | `/admin/console/login` | Sign in with a Firebase admin email and password. |
| Home | `/admin/console/` | Dashboard with shortcuts to core console areas. |
| Subgraphs | `/admin/console/subgraphs` | Inspect discovered subgraphs, URLs, labels, and health status. |
| Gateway Status | `/admin/console/status` | Monitor uptime, discovery mode, and service count. |
| User Information | `/admin/console/user` | View the authenticated user's UID, email, roles, and token expiration. |
| Role Management | `/admin/console/roles` | Assign Firebase custom-claim roles by email or UID. |
| GraphQL Sandbox Health Check | Sidebar action | Check subgraph health before opening the authenticated GraphQL Sandbox. |

## Navigation

The authenticated console shell includes:

- Header with logo, graph scope when configured, theme toggle, and logout button.
- Sidebar links for Home, Subgraphs, Status, User Info, Roles, and GraphQL Sandbox.
- Main content area for the selected page.

## Screenshots

![Admin console login page](./admin-console/screenshots/login.png)

![Admin console home page](./admin-console/screenshots/home.png)

![Admin console subgraphs page](./admin-console/screenshots/subgraphs.png)

![Admin console gateway status page](./admin-console/screenshots/status.png)

![Admin console user information page](./admin-console/screenshots/user-info.png)

![Admin console role management page](./admin-console/screenshots/roles.png)

![Admin console GraphQL Sandbox health check in progress](./admin-console/screenshots/sandbox-health-modal.png)

![Admin console GraphQL Sandbox completed health check](./admin-console/screenshots/sandbox-health-modal-complete.png)
