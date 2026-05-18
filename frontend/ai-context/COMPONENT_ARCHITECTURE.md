# Component Architecture

## Component Layers

### 1) UI Primitives (`src/components/ui`)

Low-level reusable building blocks:

- button
- input
- card
- badge
- progress
- table
- skeleton

### 2) Shared Components (`src/components/common`)

Cross-feature components:

- LoadingState
- ErrorState
- EmptyState
- StatusBadge
- LanguageSwitcher
- Modal wrappers

### 3) Feature Components

Located under:

- `src/components/dashboard`
- `src/components/onboarding`
- `src/components/chatbot`

These compose UI primitives and shared components into domain-specific sections.

### 4) Feature Pages (`src/features/**/pages`)

Page-level orchestration:

- trigger data hooks
- compose sections
- manage page-specific interactions

## Component Responsibilities

- **Presentation components**: render UI only
- **Hooks/services**: own data and side effects
- **Pages/layouts**: coordinate feature-level behavior

## Composition Rules

- Prefer composition over duplication.
- Keep props typed and minimal.
- Keep feature-specific markup out of primitive UI components.
- Keep shared states and messaging patterns consistent across pages.
