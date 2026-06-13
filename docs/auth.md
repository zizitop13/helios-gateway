---
title: Authentication
nav_section: home
---

# Authentication

Helios Gateway uses Firebase Authentication for identity and role claims, then
enforces role-based access control while executing operations through the
federated graph.

Clients send Firebase ID tokens in the `Authorization` header:

```text
Authorization: Bearer <firebase-id-token>
```

## Firebase Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Recommended | - | Firebase project id used by Firebase Admin SDK. Also used as the Cloud Run project fallback. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | No | - | Path to a Firebase service account JSON file. If omitted, Firebase Admin uses default credentials. |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local emulator | - | Firebase Auth emulator host, for example `firebase-auth-emulator:9099` in Docker Compose. |
| `SUPER_ADMIN_ID` | No | - | UID or email that bypasses `admin` role checks for admin API access. |

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
