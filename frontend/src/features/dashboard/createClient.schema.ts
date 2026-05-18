import { z } from "zod";

export const serviceTierOptions = ["Starter", "Professional", "Enterprise"] as const;
export const clientTypeOptions = ["Corporate", "SME", "Startup", "Individual"] as const;

export const createClientSchema = z.object({
  companyName: z.string().trim().min(2, "validation.companyNameMin"),
  contactPerson: z.string().trim().min(2, "validation.contactPersonMin"),
  email: z.email("validation.email"),
  jurisdiction: z.string().trim().min(2, "validation.jurisdictionRequired"),
  serviceTier: z.enum(serviceTierOptions, { error: "validation.serviceTierRequired" }),
  clientType: z.enum(clientTypeOptions, { error: "validation.clientTypeRequired" }),
});

export type CreateClientFormValues = z.infer<typeof createClientSchema>;
