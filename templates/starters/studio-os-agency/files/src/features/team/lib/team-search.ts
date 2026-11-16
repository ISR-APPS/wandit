// The search params of the Team page: the period lives in the URL, as /app/team?days=90.
// The /app/team route validates the URL with this schema.
import { z } from "zod";
import { periodDaysSchema } from "~/features/studio";

/** A missing or unknown period opens the last 30 days. */
export const teamSearchSchema = z.object({ days: periodDaysSchema });
