# Design System

## Design Goals

- Clean
- Professional
- Minimal
- Enterprise-friendly
- Accessible and responsive

## Visual Foundations

### Color Intent

- **Primary**: action and progress emphasis
- **Neutral**: layout, typography, surfaces
- **Success/Warning/Error**: status communication

### Typography

- Base font: Inter/system sans-serif
- Clear heading scale for section hierarchy
- Body text optimized for readability

### Spacing and Layout

- Card-based composition
- Consistent paddings/margins across sections
- Mobile-first breakpoints with progressive enhancement

## Component Styling Guidelines

### Buttons

- Primary, outline, and ghost patterns
- Consistent height and corner radius
- Clear hover/focus-visible states

### Cards

- Soft border and subtle shadow
- Rounded corners
- Consistent internal spacing

### Inputs and Forms

- Explicit labels
- Clear validation errors
- Focus ring and keyboard accessibility support

## Interaction Guidelines

- Use subtle transitions for hover/focus/state changes
- Prefer small Framer Motion transitions for screen sections
- Keep animation durations short and non-distracting

## Status and Feedback

- Loading states: skeleton/spinner with contextual labels
- Empty states: concise explanation + CTA when possible
- Error states: clear cause + retry action when available

## Workflow-Specific UI Guidance

- Onboarding stepper should clearly show: pending, current, blocked, completed
- Upload UI should provide file constraints and progress feedback
- Chat UI should separate user vs assistant messages clearly
