import { z } from "zod";

import { CURRENCY_CODES } from "@/lib/constants/currencies";

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name").max(50, "That name is a bit long"),
  currency: z.enum(CURRENCY_CODES),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
