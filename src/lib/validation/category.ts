import { z } from "zod";

import { CATEGORY_COLOR_KEYS } from "@/lib/constants/colors";
import { CATEGORY_ICON_KEYS } from "@/lib/constants/icons";
import type { CategoryInput } from "@/types";

export const CATEGORY_NAME_MAX_LENGTH = 32;

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name")
    .max(CATEGORY_NAME_MAX_LENGTH, `Keep it under ${CATEGORY_NAME_MAX_LENGTH} characters`),
  icon: z.enum(CATEGORY_ICON_KEYS),
  color: z.enum(CATEGORY_COLOR_KEYS),
}) satisfies z.ZodType<CategoryInput>;

export type CategoryFormValues = z.infer<typeof categorySchema>;
