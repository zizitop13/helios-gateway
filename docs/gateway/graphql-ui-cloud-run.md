# GraphQL UI in Cloud Run

When running locally, `/graphql` may show Apollo Sandbox. In Cloud Run, this project runs with `NODE_ENV=production` (see `Dockerfile`), so Apollo shows the production landing page instead (the page with `curl` example) unless Sandbox is enabled explicitly.

This is expected behavior.

- Browser URL: `https://<gateway-url>/graphql`
- API calls: use `POST` JSON requests to the same URL

Windows `curl` note: if you get `CRYPT_E_NO_REVOCATION_CHECK`, it is a local Schannel TLS revocation-check issue. Try:

```bash
curl --ssl-no-revoke --request POST \
  --header 'content-type: application/json' \
  --url 'https://<gateway-url>/graphql' \
  --data '{"query":"query { __typename }"}'
```

To force embedded Apollo Sandbox at `/graphql`, set:

```bash
ENABLE_APOLLO_SANDBOX=true
```

With that flag enabled, the gateway also turns on GraphQL introspection for the landing page so the schema can be explored from Sandbox.
