// The search params of the client list: the client whose sheet is open lives in the URL (?client=cli-04).
// The /app/clients route validates the URL with this schema. The matter pages link to one client with it.
import { z } from "zod";

/** `client` is the id of the open sheet. The sheet query checks that the id exists. */
export const clientsSearchSchema = z.object({
	client: z.string().max(40).optional().catch(undefined),
});
