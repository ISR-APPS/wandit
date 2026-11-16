// The search params of the audience page: the type tab and the open audience panel live in the URL.
// The /app/audiences route validates the URL with this schema. The campaign page links to one audience with it.
import { z } from "zod";
import { AUDIENCE_TYPES } from "~/features/marketing";

/** `type` is absent for "All". `audience` is the id of the open panel; an unknown id opens no panel. */
export const audiencesSearchSchema = z.object({
	type: z.enum(AUDIENCE_TYPES).optional().catch(undefined),
	audience: z.string().max(40).optional().catch(undefined),
});
