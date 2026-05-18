# AI Context Documentation

This directory contains implementation context for contributors and coding agents.

## Purpose

Use these documents to quickly understand:

- product expectations
- architecture decisions
- API boundaries
- state and component ownership
- UI and workflow behavior
- delivery rules for frontend changes

## Document Index

- `FRONTEND_REQUIREMENTS.md` — product and feature requirements
- `PROJECT_RULES.md` — engineering and architecture rules
- `DESIGN_SYSTEM.md` — UI style guidelines and interaction principles
- `API_CONTRACTS.md` — API endpoint reference used by frontend services
- `STATE_ARCHITECTURE.md` — state management design (Zustand + React Query)
- `COMPONENT_ARCHITECTURE.md` — component structure and ownership
- `UI_FLOW.md` — end-to-end user and screen flows
- `CLAUDE_INSTRUCTIONS.md` — agent-specific execution expectations
- `TODO.md` — prioritized improvement backlog

## How to Use This Folder

1. Start with `FRONTEND_REQUIREMENTS.md` and `PROJECT_RULES.md`.
2. Verify implementation boundaries in `API_CONTRACTS.md`.
3. Follow architecture references (`STATE_ARCHITECTURE.md`, `COMPONENT_ARCHITECTURE.md`).
4. Validate UX behavior against `UI_FLOW.md` and `DESIGN_SYSTEM.md`.
5. Track outstanding work in `TODO.md`.

## Source of Truth Notes

- Runtime/frontend behavior should always be verified against source code.
- If documentation and code diverge, update docs in the same PR that resolves the mismatch.
