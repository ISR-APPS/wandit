// The search params of the budgets page: the month that the page shows and the budget of the open side panel.
// The /app/budgets route validates the URL with the schema.
import { z } from "zod";
import { CATEGORY_IDS } from "~/features/ledger";

/**
 * `?month=previous` shows the month before. An absent or unknown value shows the current month.
 * `?category=software` opens the side panel of that budget. An unknown value opens no panel.
 */
export const budgetsSearchSchema = z.object({
	month: z.enum(["previous"]).optional().catch(undefined),
	category: z.enum(CATEGORY_IDS).optional().catch(undefined),
});
