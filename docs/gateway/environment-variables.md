# Gateway Environment Variables

These variables are used by the gateway runtime and admin features.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `4000` | HTTP port for the gateway server. |
| `DISCOVERY_MODE` | No | `cloudrun` | Subgraph discovery mode: `cloudrun`, `docker`, or `file`. |
| `GCP_PROJECT_ID` | Cloud Run mode | - | GCP project used for Cloud Run discovery. If missing, `FIREBASE_PROJECT_ID` is used as fallback. |
| `GCP_REGION` | No | `us-central1` | Cloud Run region to scan for services. |
| `ENABLE_CLOUD_RUN_IAM_AUTH` | No | `false` | If `true`, gateway attaches identity tokens when calling downstream Cloud Run services. |
| `DOCKER_SOCKET_PATH` | Docker mode | `/var/run/docker.sock` | Docker socket path used for Docker discovery. |
| `DISCOVERY_FILE_PATH` | File mode | - | Path to YAML file used for file discovery. |
| `GRAPH_NAME` | No | - | Optional graph scope name. When set, gateway discovers only subgraphs with a matching label value. |
| `GRAPH_LABEL_KEY` | No | `graph` | Label key used with `GRAPH_NAME` filtering (for example `graph=pet-shop`). |
| `FIREBASE_PROJECT_ID` | Recommended | - | Firebase project id for auth and fallback project id for Cloud Run discovery. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | No | - | Path to Firebase service account JSON used by Firebase Admin SDK. |
| `ADMIN_CONSOLE_ENABLED` | No | `false` | Enables serving the admin UI route (`/admin/console`). Set to `true` to expose the UI. |
| `ENABLE_APOLLO_SANDBOX` | No | `false` | Forces embedded Apollo Sandbox to be served at `/graphql`, including in production-style deployments such as Cloud Run. |
| `ENABLE_SCHEMA_REFRESH` | No | `true` | Enables periodic rediscovery + recomposition and applies runtime supergraph updates without restarting ApolloServer. |
| `SCHEMA_REFRESH_INTERVAL_SECONDS` | No | `60` | Refresh interval in seconds used when `ENABLE_SCHEMA_REFRESH=true`. |
| `ADMIN_CONSOLE_FIREBASE_API_KEY` | Admin console login | - | Firebase Web API key returned to the admin UI from `/admin/config/firebase`. |
| `ADMIN_CONSOLE_FIREBASE_AUTH_DOMAIN` | Admin console login | - | Firebase Auth domain for the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_PROJECT_ID` | Admin console login | - | Firebase project id used by the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_APP_ID` | Admin console login | - | Firebase app id for the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_STORAGE_BUCKET` | No | - | Optional Firebase storage bucket returned to the admin UI when your project uses Storage. |
| `ADMIN_CONSOLE_FIREBASE_MESSAGING_SENDER_ID` | No | - | Optional Firebase messaging sender id for the admin UI web app configuration. |
| `ADMIN_CONSOLE_FIREBASE_MEASUREMENT_ID` | No | - | Optional Firebase Analytics measurement id for the admin UI web app configuration. |
| `SUPER_ADMIN_ID` | No | - | UID or email that bypasses `admin` role check for admin API access. |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | - | Path to Google ADC JSON file for local auth to Cloud Run APIs or IAM token flows. |

## Notes

- For `DISCOVERY_MODE=cloudrun`, either `GCP_PROJECT_ID` or `FIREBASE_PROJECT_ID` must be set.
- For `DISCOVERY_MODE=file`, `DISCOVERY_FILE_PATH` must be set.
- If `GRAPH_NAME` is set, only services/containers where `<GRAPH_LABEL_KEY>=<GRAPH_NAME>` are discovered.
- Boolean flags are string-based and should be exactly `true` to enable (`ADMIN_CONSOLE_ENABLED`, `ENABLE_APOLLO_SANDBOX`, `ENABLE_SCHEMA_REFRESH`, `ENABLE_CLOUD_RUN_IAM_AUTH`).
- `GOOGLE_APPLICATION_CREDENTIALS` is consumed by Google client libraries, not by gateway config parsing directly.
- When `ADMIN_CONSOLE_ENABLED=true`, the gateway exposes `/admin/config/firebase` and returns any configured `ADMIN_CONSOLE_FIREBASE_*` values to the browser.
- For GitHub Actions deployments, you can store the admin console Firebase values as repository variables and pass them through `.github/workflows/cloudrun.yml`.
