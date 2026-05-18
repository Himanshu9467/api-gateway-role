import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("validation.email"),
  password: z.string().min(6, "validation.passwordMin"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "validation.nameMin"),
    email: z.email("validation.email"),
    password: z.string().min(8, "validation.passwordMin"),
    confirmPassword: z.string().min(8, "validation.passwordMin"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
