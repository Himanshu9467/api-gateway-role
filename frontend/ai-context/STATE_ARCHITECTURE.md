# State Architecture

## State Strategy

Use the right state tool for the right responsibility:

- **Zustand**: app-level client state
- **React Query**: server state and async lifecycle
- **Local component state**: transient UI interactions

## Zustand Stores

### `src/store/auth.store.ts`

- token/user persistence
- auth hydration
- login session state
- logout/reset behavior

### `src/store/onboarding.store.ts`

- selected client/step
- upload progress feedback
- workflow validation messaging

### `src/store/chatbot.store.ts`

- chat draft message
- suggested prompts state

### `src/store/ui.store.ts` (if used)

- app-wide presentation flags (modals, layout controls, notifications)

## React Query Responsibilities

- data fetching
- cache management
- retry/error lifecycle
- mutation and cache invalidation

## State Boundaries

- Keep remote/server data in React Query.
- Keep cross-page UI/session state in Zustand.
- Avoid mirroring React Query data in global store unless required.

## Recommended Patterns

- Derive UI from query state (`isLoading`, `isError`, `data`)
- Use feature hooks to encapsulate query/mutation config
- Keep selectors narrow to reduce unnecessary re-renders
