# Agent Implementation Instructions

Use this guide when acting as a coding agent or implementation assistant for this repository.

## Mission

Implement production-quality frontend changes while preserving existing architecture, typing, and workflow behavior.

## Required Context First

Before coding:

1. Read `README.md`.
2. Read `ai-context/PROJECT_RULES.md`.
3. Validate relevant feature flows in `ai-context/UI_FLOW.md`.
4. Verify API usage in `ai-context/API_CONTRACTS.md`.

## Implementation Principles

- Keep changes scoped and intentional.
- Reuse existing components and hooks.
- Keep API logic in service/API layers.
- Keep UI text translation-ready.
- Respect feature/module boundaries.

## Engineering Expectations

- Type-safe code only.
- No hardcoded backend URLs in UI components.
- Strong loading/error/empty state handling.
- Responsive behavior preserved.
- Accessibility and keyboard interactions considered.

## Validation Expectations

- Run project build and lint commands before finalizing work.
- Call out pre-existing unrelated failures if present.
- Avoid introducing unrelated refactors in focused tasks.

## Output Expectations for Agent PRs

- Clear summary of what changed
- Affected files and rationale
- Validation results
- Risks/limitations, if any
