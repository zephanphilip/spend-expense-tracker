import { z } from "zod";

const email = z.email("Enter a valid email address").trim();

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(50, "That name is a bit long"),
  email,
  password: z.string().min(8, "Use at least 8 characters"),
});

export const resetPasswordSchema = z.object({ email });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
