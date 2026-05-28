/**
 * ai.service.ts
 * AI Engineer: Mahika
 *
 * Covers:
 *  - AI-based dynamic checklist generation
 *  - AI chatbot (/api/ai/chat)
 *  - AI explanation system for errors
 *  - Next-step suggestion logic
 *  - Prompt design for all AI features
 *
 * Provider: Google Gemini (swap GEMINI_API_KEY → OPENAI_API_KEY and
 * update the fetch target to use OpenAI if needed — interface stays the same).
 */

import { Request, Response } from "express";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  reason: string;
  step: string;
}

export interface NextStepSuggestion {
  nextStep: string;
  reason: string;
  urgency: "high" | "medium" | "low";
}

export interface ErrorExplanation {
  plain: string;       // human-readable explanation
  action: string;      // what the user should do
  learnMore?: string;  // optional doc/link hint
}

// ---------------------------------------------------------------------------
// Core LLM helper
// ---------------------------------------------------------------------------

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// 1. Dynamic checklist generator
// ---------------------------------------------------------------------------

const CHECKLIST_SYSTEM_PROMPT = `
You are a compliance expert for a financial/legal onboarding platform.
Given a client type and onboarding step, return a JSON array of required documents.
Each item must have: id (snake_case string), label (short name), required (boolean),
reason (one sentence why it's needed), step (the onboarding step it belongs to).
Return ONLY valid JSON — no markdown, no explanation outside the array.
`.trim();

export async function generateChecklist(
  clientType: string,
  onboardingStep: string,
  extraContext?: string
): Promise<ChecklistItem[]> {
  const userPrompt = `
Client type: ${clientType}
Onboarding step: ${onboardingStep}
${extraContext ? `Additional context: ${extraContext}` : ""}

Generate the document checklist for this client and step.
`.trim();

  const raw = await callGemini(CHECKLIST_SYSTEM_PROMPT, userPrompt);

  // Strip accidental markdown fences
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as ChecklistItem[];
}

// Express handler
export async function handleGenerateChecklist(req: Request, res: Response) {
  const { clientType, onboardingStep, extraContext } = req.body as {
    clientType: string;
    onboardingStep: string;
    extraContext?: string;
  };

  if (!clientType || !onboardingStep) {
    return res.status(400).json({ error: "clientType and onboardingStep are required." });
  }

  try {
    const checklist = await generateChecklist(clientType, onboardingStep, extraContext);
    return res.json({ checklist });
  } catch (err) {
    console.error("[AI] checklist generation failed", err);
    return res.status(500).json({ error: "Failed to generate checklist." });
  }
}

// ---------------------------------------------------------------------------
// 2. Chatbot — answers onboarding questions
// ---------------------------------------------------------------------------

const CHAT_SYSTEM_PROMPT = `
You are a friendly, concise onboarding assistant for a financial services platform.
Help users understand what documents to upload, why they're needed, and what to do next.
Keep answers under 3 sentences unless the user asks for detail.
Never give legal advice — suggest consulting a compliance officer for complex questions.
If you don't know something, say so clearly rather than guessing.
`.trim();

export async function getAIChatResponse(
  history: ChatMessage[],
  newMessage: string,
  context?: { clientId?: string; stepKey?: string }
): Promise<string> {
  // Build a conversation string (Gemini Flash doesn't do multi-turn natively in this simple call)
  const historyText = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const contextHint = context
    ? `[Context: clientId=${context.clientId ?? "unknown"}, step=${context.stepKey ?? "unknown"}]`
    : "";

  const userPrompt = `
${contextHint}
${historyText ? `Conversation so far:\n${historyText}\n` : ""}
User: ${newMessage}
`.trim();

  return callGemini(CHAT_SYSTEM_PROMPT, userPrompt);
}

// Express handler
export async function handleChat(req: Request, res: Response) {
  const { message, history = [], clientId, stepKey } = req.body as {
    message: string;
    history?: ChatMessage[];
    clientId?: string;
    stepKey?: string;
  };

  if (!message) {
    return res.status(400).json({ error: "message is required." });
  }

  try {
    const reply = await getAIChatResponse(history, message, { clientId, stepKey });
    return res.json({
      reply,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[AI] chat failed", err);
    return res.status(500).json({ error: "AI chat unavailable." });
  }
}

// ---------------------------------------------------------------------------
// 3. Error explanation system
// ---------------------------------------------------------------------------

const ERROR_SYSTEM_PROMPT = `
You are an onboarding support specialist. Given a technical or validation error code/message,
return a JSON object with three fields:
  plain   — a clear, non-technical one-sentence explanation for the end user
  action  — exactly what the user should do to fix it (imperative, one sentence)
  learnMore — a short phrase hinting at further help (optional, can be empty string)
Return ONLY valid JSON. No markdown fences.
`.trim();

export async function explainError(
  errorCode: string,
  errorMessage: string,
  documentType?: string
): Promise<ErrorExplanation> {
  const userPrompt = `
Error code: ${errorCode}
Error message: ${errorMessage}
${documentType ? `Document type involved: ${documentType}` : ""}
`.trim();

  const raw = await callGemini(ERROR_SYSTEM_PROMPT, userPrompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as ErrorExplanation;
}

// Express handler
export async function handleExplainError(req: Request, res: Response) {
  const { errorCode, errorMessage, documentType } = req.body as {
    errorCode: string;
    errorMessage: string;
    documentType?: string;
  };

  if (!errorCode || !errorMessage) {
    return res.status(400).json({ error: "errorCode and errorMessage are required." });
  }

  try {
    const explanation = await explainError(errorCode, errorMessage, documentType);
    return res.json({ explanation });
  } catch (err) {
    console.error("[AI] error explanation failed", err);
    return res.status(500).json({ error: "Failed to generate explanation." });
  }
}

// ---------------------------------------------------------------------------
// 4. Next-step suggestion
// ---------------------------------------------------------------------------

const NEXT_STEP_SYSTEM_PROMPT = `
You are an onboarding workflow advisor. Given a client's current progress,
suggest the single most important next action.
Return a JSON object with:
  nextStep  — short label for the next action
  reason    — one sentence explaining why this is the priority
  urgency   — one of: "high", "medium", "low"
Return ONLY valid JSON. No markdown.
`.trim();

export async function suggestNextStep(
  completedSteps: string[],
  pendingDocuments: string[],
  clientType: string
): Promise<NextStepSuggestion> {
  const userPrompt = `
Client type: ${clientType}
Completed steps: ${completedSteps.join(", ") || "none"}
Pending documents: ${pendingDocuments.join(", ") || "none"}
`.trim();

  const raw = await callGemini(NEXT_STEP_SYSTEM_PROMPT, userPrompt);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as NextStepSuggestion;
}

// Express handler
export async function handleNextStep(req: Request, res: Response) {
  const { completedSteps = [], pendingDocuments = [], clientType } = req.body as {
    completedSteps?: string[];
    pendingDocuments?: string[];
    clientType: string;
  };

  if (!clientType) {
    return res.status(400).json({ error: "clientType is required." });
  }

  try {
    const suggestion = await suggestNextStep(completedSteps, pendingDocuments, clientType);
    return res.json({ suggestion });
  } catch (err) {
    console.error("[AI] next-step suggestion failed", err);
    return res.status(500).json({ error: "Failed to generate suggestion." });
  }
}
