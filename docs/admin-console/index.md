---
title: Admin Console
---

# Admin Console

React UI for gateway administration, built from `admin-console` and served by the gateway at `/admin/console`.

Important: the UI route is `/admin/console`, not `/admin-console`.

When gateway is configured with `GRAPH_NAME`, the Admin Console header shows the active graph scope and label key so operators know which subgraph group is currently in scope.

## Scripts

- `npm run build`: build production UI into `admin-console/dist`.
- `npm run preview`: preview built UI.
- `npm run lint`: lint admin console sources.

Note: there is currently no `npm run dev` script in `admin-console/package.json`.
