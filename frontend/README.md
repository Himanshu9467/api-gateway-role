# AI Onboarding Frontend

A production-focused React frontend for managing client onboarding workflows, document collection, and AI-assisted guidance.

## Project Overview

Login  credentials:
- username: testuser@gmail.com
- password: Test@123

This application provides the user-facing interface for an onboarding platform where teams can:

- authenticate users
- review onboarding status from a dashboard
- create and track clients
- upload and validate onboarding documents
- use an AI assistant for onboarding guidance
- work in multiple languages (English, Hindi, Spanish)

The frontend communicates with backend services through an API Gateway.

## Features

- Authentication: login and registration flows
- Protected routing with redirect handling
- Dashboard with summary cards, client list, and activity timeline
- Client detail view with onboarding status
- Step-based onboarding workflow
- Document upload with validation and progress
- AI chatbot panel with suggested prompts
- Shared loading, empty, and error states
- i18n support using `react-i18next`
- Mock API fallback for local/demo usage

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS 4
- **Routing**: React Router 7
- **Server State**: TanStack React Query
- **Client State**: Zustand
- **Forms/Validation**: react-hook-form + Zod
- **HTTP**: Axios
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **i18n**: i18next + react-i18next

## Folder Structure

```text
src/
  api/                  # Axios client and API-layer wrappers
  components/           # Reusable UI and feature components
    chatbot/
    common/
    dashboard/
    onboarding/
    ui/
  config/               # Runtime config helpers
  constants/            # App constants and route/workflow metadata
  features/             # Feature pages + feature hooks
    auth/
    chatbot/
    clients/
    dashboard/
    onboarding/
    settings/
  hooks/                # App-level custom hooks
  i18n/                 # i18n setup and locale dictionaries
  layouts/              # Route layouts
  routes/               # Route definitions and guards
  services/             # Service layer (auth/dashboard/onboarding/chatbot)
  store/                # Zustand stores
  styles/               # Global styles
  types/                # Shared TypeScript types
  utils/                # Utility helpers
```

## Installation

### Prerequisites

- Node.js 18+
- npm 8+

### Steps

```bash
git clone https://github.com/Darshannaik484/onboarding-frontend.git
cd onboarding-frontend
npm install
```

## Environment Setup

Create a `.env.local` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_DEMO_MODE=true
```

Reference: `.env.example`

## Run Commands

```bash
npm run dev      # Start Vite development server
npm run build    # TypeScript build + Vite production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Build and Validation Notes

- Primary validation commands are `npm run lint` and `npm run build`.
- If backend services are unavailable, the frontend can fall back to mock APIs (depending on runtime conditions and `VITE_DEMO_MODE`).

## Architecture Explanation

The app follows a feature-modular architecture:

- **Layouts + Routes** define authenticated/public navigation.
- **Feature pages** orchestrate data-fetching and composition.
- **Reusable components** render UI with minimal business logic.
- **Service layer** encapsulates API access and fallback behavior.
- **Zustand** handles client-side global state (auth, onboarding, chatbot, UI).
- **React Query** handles server state, caching, invalidation, and async lifecycle.

### Data Flow (high level)

1. Page triggers feature hook/query.
2. Hook calls service function.
3. Service uses Axios client (`src/api/axios.ts`).
4. Response updates React Query cache and UI.
5. Mutations invalidate dependent queries as needed.

## API Usage

Base URL comes from `VITE_API_BASE_URL` (default: `http://localhost:4000`).

Main frontend endpoints used:

- `POST /api/auth/login`
- `POST /api/auth/register` (fallback: `/api/auth/signup`)
- `GET /api/dashboard/summary`
- `GET /api/dashboard/clients`
- `GET /api/dashboard/activity`
- `POST /api/clients`
- `GET /api/clients/:clientId`
- `GET /api/onboarding/:clientId/progress`
- `GET /api/onboarding/:clientId/documents?step=:stepKey`
- `POST /api/onboarding/:clientId/documents/upload`
- `GET /api/ai/chat/messages?clientId=&stepKey=`
- `POST /api/ai/chat`

For detailed contracts, see `ai-context/API_CONTRACTS.md`.

## Workflow Explanation

### Frontend User Workflow

1. User logs in.
2. Dashboard loads summary, clients, and activity.
3. User opens a client or creates a new one.
4. User proceeds through onboarding steps.
5. User uploads required files per step.
6. User consults AI assistant when needed.
7. Progress and status update across dashboard and client pages.

## Frontend Responsibilities

- Provide consistent and accessible UI/UX
- Validate user input before submission
- Display loading/empty/error states for all async screens
- Keep UI text translatable
- Keep domain/business calls in service/API layer
- Preserve route protection and auth state handling

## Contribution and Setup Notes

- Keep changes scoped and modular.
- Reuse existing UI primitives in `src/components/ui` when possible.
- Keep API calls in `src/services` / `src/api`, not in presentation components.
- Use TypeScript types for payloads and responses.
- Run `npm run build` before opening or updating a PR.
- Run `npm run lint` and document any pre-existing lint issues if unrelated.

## Additional Project Context

See `ai-context/` for architecture references, implementation rules, API contracts, UI flow, and AI-agent context.
