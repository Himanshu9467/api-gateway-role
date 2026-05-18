# API Contracts

This frontend integrates with backend services through the API Gateway.

- **Gateway base URL**: `http://localhost:4000` (or `VITE_API_BASE_URL`)
- **Transport**: JSON for standard endpoints, multipart form data for file uploads
- **Auth**: Bearer token in `Authorization` header

---

## Authentication

### `POST /api/auth/login`

Authenticate a user.

**Request**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**

```json
{
  "token": "jwt-or-session-token",
  "user": {
    "id": "u_123",
    "name": "Jane Doe",
    "email": "user@example.com"
  }
}
```

### `POST /api/auth/register`

Register a user account.

**Request**

```json
{
  "name": "Jane Doe",
  "email": "user@example.com",
  "password": "password123"
}
```

**Behavior notes**

- Frontend supports fallback to `POST /api/auth/signup` if `/register` returns `404`.

---

## Dashboard and Client Management

### `GET /api/dashboard/summary`

Returns top-level dashboard counts.

### `GET /api/dashboard/clients`

Returns dashboard client summary collection.

### `GET /api/dashboard/activity`

Returns activity timeline items for dashboard.

### `POST /api/clients`

Creates a new client.

**Request**

```json
{
  "companyName": "Acme Holdings",
  "contactPerson": "Anita Rao",
  "email": "anita.rao@acmeholdings.com",
  "jurisdiction": "Singapore",
  "serviceTier": "Enterprise",
  "clientType": "Corporate"
}
```

**Response**

- Either a direct client object, or `{ "client": { ... } }`.
- Frontend normalizes both response shapes.

### `GET /api/clients/:clientId`

Returns a single client detail payload.

---

## Onboarding Workflow

### `GET /api/onboarding/:clientId/progress`

Returns current onboarding progress, current step, status, and step metadata.

### `GET /api/onboarding/:clientId/documents?step=:stepKey`

Returns documents uploaded for a specific workflow step.

### `POST /api/onboarding/:clientId/documents/upload`

Uploads a document for a workflow step.

**Request (multipart/form-data)**

- `file`: binary file
- `stepKey`: workflow step identifier

**Frontend behavior**

- Upload progress is tracked using Axios `onUploadProgress`.

---

## AI Chatbot

### `GET /api/ai/chat/messages?clientId=:clientId&stepKey=:stepKey`

Returns chat history for a client/step context.

### `POST /api/ai/chat`

Sends a message and returns AI response plus optional suggestions.

---

## Error Handling and Fallbacks

- Service layer maps backend/transport errors into user-friendly messages where applicable.
- Mock API fallback is supported for local/demo environments.
- Frontend must always render loading, empty, and error states for async data.
