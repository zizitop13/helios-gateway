---
title: Admin Console
nav_section: contributing
---

# Admin Console

The Admin Console is the browser UI for operating Helios Gateway. It is served by the gateway at:

```text
http://localhost:4000/admin/console/
```

The console requires Firebase authentication. After login, the layout provides persistent navigation for gateway operations, user information, role assignment, and GraphQL Sandbox access.

## Pages

| Page | Route | Purpose |
| --- | --- | --- |
| [Login](./login.html) | `/admin/console/login` | Sign in with a Firebase admin email and password. |
| [Home](./home.html) | `/admin/console/` | Dashboard with shortcuts to core console areas. |
| [Subgraphs](./subgraphs.html) | `/admin/console/subgraphs` | Inspect discovered subgraphs, URLs, labels, and health status. |
| [Gateway Status](./status.html) | `/admin/console/status` | Monitor uptime, discovery mode, and service count. |
| [User Information](./user-info.html) | `/admin/console/user` | View the authenticated user's UID, email, roles, and token expiration. |
| [Role Management](./roles.html) | `/admin/console/roles` | Assign Firebase custom-claim roles by email or UID. |
| [GraphQL Sandbox Health Check](./sandbox.html) | Sidebar action | Check subgraph health before opening the authenticated GraphQL Sandbox. |

## Navigation

The authenticated console shell includes:

- Header with logo, graph scope when configured, theme toggle, and logout button.
- Sidebar links for Home, Subgraphs, Status, User Info, Roles, and GraphQL Sandbox.
- Main content area for the selected page.
