// The search params of the campaign list: the status tab and the channel filter live in the URL.
// The /app/campaigns route validates the URL with this schema. The home status panel links here with `?status=`.
import { z } from "zod";
import { CAMPAIGN_STATUSES, CHANNELS } from "~/features/marketing";

/** Each param is absent for "All". An unknown value in the URL also reads as absent. */
export const campaignsSearchSchema = z.object({
	status: z.enum(CAMPAIGN_STATUSES).optional().catch(undefined),
	channel: z.enum(CHANNELS).optional().catch(undefined),
});
