# Pets Shop UI

Simple React + Mantine test UI for the federated pets shop.

## Features

- Firebase email/password authentication
- Sends Firebase ID token to gateway as `Authorization: Bearer <token>`
- Reads federated data (`pets`, `orders`, `customers`) from gateway `/graphql`
- Displays roles extracted from Firebase custom claims

## Run

```bash
npm install
npm run dev-pet-shop-ui
```

Default URL: `http://localhost:5173`

## Configuration

Copy `.env.example` to `.env.local` and set values as needed.

- `VITE_GATEWAY_URL` (default: `http://localhost:4000`)
- `VITE_FIREBASE_*` values for the Firebase web app used by local authentication

## Docker

The Docker image serves the built app with nginx. Runtime configuration is
written to `/runtime-config.js` from container environment variables, so the
same image can be deployed to different Cloud Run projects without rebuilding.
