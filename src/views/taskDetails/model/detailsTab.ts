import { z } from "zod";

export const DetailsTabSchema = z.enum(["task", "decompose", "update"]);
export type DetailsTab = z.infer<typeof DetailsTabSchema>;

export const DEFAULT_DETAILS_TAB: DetailsTab = "task";

export const parseDetailsTab = (value: string | null | undefined): DetailsTab => {
  const parsed = DetailsTabSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_DETAILS_TAB;
};
