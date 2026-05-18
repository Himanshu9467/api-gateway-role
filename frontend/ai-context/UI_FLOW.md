# UI Flow

## End-to-End Journey

1. User authenticates (login/register).
2. User lands on dashboard.
3. User opens existing client or creates a new client.
4. User enters onboarding workflow.
5. User uploads documents step-by-step.
6. User uses AI assistant for guidance.
7. User reviews progress and completes workflow.

## Authentication Flow

### Login

- Enter email/password
- Validate form
- Submit request
- Persist auth session
- Redirect to protected route/dashboard

### Register

- Enter account details
- Validate inputs
- Create account
- Redirect to login

## Dashboard Flow

- Load summary metrics
- Load client cards
- Load recent activity
- Open client detail or continue onboarding
- Create new client via modal form

## Client Detail Flow

- Fetch client metadata and status
- Show progress percentage
- Navigate to onboarding overview

## Onboarding Overview Flow

- Fetch onboarding progress
- Display overall status and workflow stepper
- Continue current step or return to client detail

## Onboarding Step Flow

- Load selected step content
- Show required checklist
- Handle document upload and progress
- Show uploaded document list
- Display validation errors when needed
- Use AI chatbot for context help
- Navigate previous/next steps

## Document Upload Interaction

- Select or drop file
- Validate type and size
- Start upload
- Track upload progress
- Refresh documents for current step

## Chatbot Interaction

- Load context messages by client and step
- Show suggested prompts
- Send user message
- Show assistant typing state and response

## Global UX Behaviors

- Protected routes for authenticated areas
- Loading/empty/error states on all async screens
- Responsive support across mobile/tablet/desktop
- Language switching with runtime UI updates
