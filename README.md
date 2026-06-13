<div align="center">
  <img src="docs/assets/logo.png" alt="logo" width="450">
</div>



<br/><br/><br/>

___

<br/><br/>


# Helios Gateway


Cloud-native GraphQL federation gateway built on top of Apollo Federation Gateway.

Helios Gateway provides dynamic service discovery, Firebase authentication, RBAC, and an admin console for managing distributed GraphQL services across cloud and local environments.

## Documentation

- [Documentation](https://zizitop13.github.io/helios-gateway/)

## Docker Images

Docker Hub:

```bash
docker pull zizitop13/helios-gateway:latest
```

GitHub Container Registry:

```bash
docker pull ghcr.io/zizitop13/helios-gateway:latest
```

## Features

- Apollo Federation Gateway–based runtime
- Dynamic service discovery
  - Google Cloud Run
  - Docker
  - Static YAML configuration
- Firebase Authentication integration
- Role-based access control (RBAC)
- Admin console
- Cloud-native and Docker-friendly
- Designed for self-hosted federated GraphQL platforms

## Licensing

Helios Gateway depends on `@apollo/gateway`, which is licensed under Elastic License 2.0 (ELv2).

This project itself is independently licensed under the [Apache License 2.0](LICENSE) and is not affiliated with or endorsed by Apollo GraphQL.

Users of this project are responsible for complying with the licenses of all included dependencies.
