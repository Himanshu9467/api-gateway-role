# Identity Federation

The gateway now supports an identity provider adapter layer while preserving the existing JWT, refresh-token rotation, RBAC middleware, and local auth routes.

## Providers

Set:

```bash
AUTH_PROVIDER=local|auth0|cognito|keycloak
```

Implemented providers:

- `LocalAuthProvider`
- `Auth0Provider`
- `CognitoProvider`
- `KeycloakProvider`

## Federated Login

External providers use:

```http
POST /api/auth/federated-login
```

Body:

```json
{
  "idToken": "<external-id-token>",
  "accessToken": "<optional-access-token>"
}
```

The gateway validates required claims, trusted issuer, and audience when configured, maps external roles, synchronizes the local `User`, writes an audit log, and returns the existing response shape:

```json
{
  "token": "<platform-jwt>",
  "refreshToken": "<opaque-refresh-token>",
  "user": { "id": "...", "name": "...", "email": "..." }
}
```

## Role Mapping

Configure:

```bash
AUTH_ROLE_CLAIM=roles
AUTH_DEFAULT_ROLE=user
```

Supported platform roles remain:

- `admin`
- `user`
- `service`

Unknown external roles are ignored. If no platform role is found, `AUTH_DEFAULT_ROLE` is assigned.

## MFA Ready

MFA remains provider-owned. The adapter records federated login audit metadata and keeps the platform token issuing path centralized, so MFA claims such as `amr`, `acr`, or Cognito challenge results can be enforced in provider-specific adapters without changing route contracts.
