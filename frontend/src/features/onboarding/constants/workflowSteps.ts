import type { WorkflowStepKey } from "../../../types/onboarding";

interface StepContent {
  titleKey: string;
  descriptionKey: string;
  checklistKeys: string[];
}

export const workflowStepOrder: WorkflowStepKey[] = [
  "identity",
  "company_documents",
  "financial_documents",
  "compliance",
  "review",
];

export const workflowStepContent: Record<WorkflowStepKey, StepContent> = {
  identity: {
    titleKey: "workflow.identity.title",
    descriptionKey: "workflow.identity.description",
    checklistKeys: ["workflow.identity.item1", "workflow.identity.item2", "workflow.identity.item3"],
  },
  company_documents: {
    titleKey: "workflow.companyDocuments.title",
    descriptionKey: "workflow.companyDocuments.description",
    checklistKeys: [
      "workflow.companyDocuments.item1",
      "workflow.companyDocuments.item2",
      "workflow.companyDocuments.item3",
    ],
  },
  financial_documents: {
    titleKey: "workflow.financialDocuments.title",
    descriptionKey: "workflow.financialDocuments.description",
    checklistKeys: [
      "workflow.financialDocuments.item1",
      "workflow.financialDocuments.item2",
      "workflow.financialDocuments.item3",
    ],
  },
  compliance: {
    titleKey: "workflow.compliance.title",
    descriptionKey: "workflow.compliance.description",
    checklistKeys: ["workflow.compliance.item1", "workflow.compliance.item2", "workflow.compliance.item3"],
  },
  review: {
    titleKey: "workflow.review.title",
    descriptionKey: "workflow.review.description",
    checklistKeys: ["workflow.review.item1", "workflow.review.item2", "workflow.review.item3"],
  },
};
