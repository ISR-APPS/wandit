// The search params of the articles page: the collection tab, and the article whose sheet is open.
// The /app/articles route validates the URL with this schema. The ticket page links to an article with it.
import { z } from "zod";
import { ARTICLE_COLLECTIONS } from "~/features/helpdesk";

/** Both params are optional. An unknown value in the URL reads as absent. */
export const articlesSearchSchema = z.object({
	collection: z.enum(ARTICLE_COLLECTIONS).optional().catch(undefined),
	/** An article id, for example "sso-setup". The page shows no sheet when no article has it. */
	article: z.string().max(60).optional().catch(undefined),
});
