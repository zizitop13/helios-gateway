# Gateway Local Development

## Local Endpoints

- GraphQL: [http://localhost:4000/graphql](http://localhost:4000/graphql)
- Admin Console UI: [http://localhost:4000/admin/console](http://localhost:4000/admin/console)
- Health: [http://localhost:4000/health](http://localhost:4000/health)

## Start Locally (from package.json scripts)

### 1) Install dependencies

```bash
cd admin-console
npm install
cd ../gateway
npm install
```

### 2) Build admin console (required for gateway UI route)

```bash
cd admin-console
npm run build
```

### 3) Start gateway in dev mode

```bash
cd gateway
npm run dev-gateway
```

This script uses `gateway/.env.local`.

## IntelliJ-Friendly Run Blocks

Run these in IntelliJ Terminal from repo root:

```bash
cd admin-console && npm run build
cd ../gateway && npm run dev-gateway
```

Windows PowerShell alternative:

```powershell
Set-Location admin-console; npm run build
Set-Location ..\gateway; npm run dev-gateway
```

## Gateway Scripts

- `npm run dev-gateway`: start gateway with `.env.local`
- `npm run build`: compile TypeScript
- `npm start`: run compiled server (`dist/index.js`)
- `npm test`: run tests
- `npm run lint`: lint gateway sources
