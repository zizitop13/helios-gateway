---
title: Admin Console Users
---

# Admin Console Users

Route: `/admin/console/users`

Search the Firebase directory by email, display name, or UID. Search ignores case
and surrounding whitespace. Use Next and Previous to move through results, then
choose **Manage roles** for an account. Disabled accounts are labeled and users
without email addresses can be selected by UID.

The editor loads assigned roles and schema role hints. Add tags to assign roles,
remove tags to remove individual roles, or choose **Clear all roles**. **Save
roles** replaces the complete role set for the selected UID. Switching users or
changing the search discards unsaved edits. A failed read blocks saving; a failed
save preserves the saved roles and editable draft for retry.

## Preview and gateway integration

This is currently a frontend-only feature. By default, the yellow **Preview
users** notice identifies in-memory sample accounts. All directory reads and
role changes stay in the browser, never touching real accounts. Changes survive
switching users but reset on reload.

`admin-console/src/usersApi.ts` exposes the same typed interface for both modes.
Once the missing gateway operations are implemented, set
`VITE_USERS_API_MODE=gateway` when building the console. This uses the authenticated
HTTP client in `api.ts` and never silently falls back to sample data on API errors.
The build variable must also be set for a deployed build; setting it only on a
running gateway does not change an already compiled console.

| Operation | Status |
| --- | --- |
| `GET /admin/api/users?search=...&pageSize=...&pageToken=...` | TODO / not implemented; listing, filtering and opaque cursor pagination. |
| `GET /admin/api/users/{uid}/roles` | TODO / not implemented; current roles for a selected Firebase UID. |
| `GET /admin/api/roles` | Existing schema role hints. |
| `POST /admin/api/users/roles` | Existing assignment API reused; send the full role set with `uid`, including `[]` to remove all roles. |

The [OpenAPI contract](../gateway/openapi.yaml) marks missing operations with
`x-implementation-status: not-implemented`. No gateway handlers are added for
this frontend task. Live assignment responses retain the reminder that affected
users must refresh their Firebase ID token for updated roles to take effect.
