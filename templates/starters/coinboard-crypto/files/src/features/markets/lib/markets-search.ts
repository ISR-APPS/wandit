// The search params of the Markets page: the direction tab lives in the URL, as /app/markets?move=rising.
// The /app/markets route validates the URL with this schema. The home links to a tab with it.
import { z } from "zod";
import { PRICE_MOVES } from "~/features/ledger";

/** `move` is absent for the "All" tab. An unknown value in the URL also reads as absent. */
export const marketsSearchSchema = z.object({
	move: z.enum(PRICE_MOVES).optional().catch(undefined),
});
