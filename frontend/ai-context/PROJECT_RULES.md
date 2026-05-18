# Project Rules

## Core Stack

- React + TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand
- React Query
- Axios
- react-hook-form + Zod
- react-i18next
- Framer Motion

## Architecture Rules

- Keep business logic out of presentational components.
- Keep API calls in `src/api` and `src/services`.
- Keep reusable UI components in `src/components`.
- Keep page-level behavior in `src/features/**/pages`.
- Keep global state in `src/store`.
- Keep shared types in `src/types`.

## UI and UX Rules

- Build mobile-first responsive interfaces.
- Use consistent spacing, typography, and visual hierarchy.
- Always provide loading, empty, and error states.
- Use status indicators for onboarding progression.
- Prefer reusable UI primitives before creating new ones.

## API and Integration Rules

- Frontend communicates through API Gateway only.
- Never hardcode environment-specific API URLs in components.
- Use typed payloads and responses.
- Handle network and validation failures gracefully.

## Internationalization Rules

- All visible user-facing text should use translation keys.
- Maintain English/Hindi/Spanish compatibility.
- Do not introduce untranslatable UI text in feature screens.

## Quality Rules

- Keep files focused and composable.
- Avoid duplicated logic.
- Use clear naming conventions.
- Prefer small, reviewable pull requests.
- Validate with project scripts before PR updates.
