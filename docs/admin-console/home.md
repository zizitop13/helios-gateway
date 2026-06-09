---
title: Admin Console Home
---

# Admin Console Home

The Home page is the authenticated landing page for gateway administrators.

![Admin console home page](./screenshots/home.png)

## Route

```text
/admin/console/
```

## Purpose

Use this page as a dashboard and shortcut hub for the main admin-console workflows.

## Cards

- `Subgraphs`: opens the discovered subgraph list.
- `Gateway Status`: opens runtime metrics and health information.
- `User Info`: opens the current authentication details page.
- `GraphQL Sandbox`: opens an authenticated GraphQL query experience.

## Layout Actions

- `Theme`: toggles light and dark mode.
- `Logout`: signs out and returns to the login page.
- Sidebar navigation: moves between Home, Subgraphs, Status, User Info, Roles, and GraphQL Sandbox.
