// The search params of the time-off page: the open request lives in the URL, as /app/time-off?request=TO-4127.
// The /app/time-off route validates the URL with this schema. The overview and the profile link to a request with it.
import { z } from "zod";

/** `request` is absent while the dialog is closed. An id with no row also keeps the dialog closed. */
export const timeOffSearchSchema = z.object({
	request: z.string().max(40).optional().catch(undefined),
});
