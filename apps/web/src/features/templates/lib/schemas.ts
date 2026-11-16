/**
 * Zod schema of the `/templates` search params: the filter state of the list page.
 * The route file routes/_auth/templates.index.tsx parses the URL with it.
 * A value the schema does not know becomes undefined, so a bad link opens the full list.
 */

// The barrel, not the subpath: the route entry loads the barrel, and the bundler then keeps the
// catalog chunk out of the first page load.
import {
	starterTemplateCategories,
	starterTemplateKinds,
} from "@wandit/contracts";
import { z } from "zod";

/** Most characters of the search text. 80 hold every name and tagline of the catalog. The search input has the same limit. */
export const SEARCH_TEXT_MAX_LENGTH = 80;

/**
 * validateSearch of the `/templates` route parses the URL with it. `q` is the
 * search text as the user typed it. `kind` and `category` filter by one value.
 * An absent field does not filter.
 */
export const templatesSearchSchema = z.object({
	q: z.string().max(SEARCH_TEXT_MAX_LENGTH).optional().catch(undefined),
	kind: z.enum(starterTemplateKinds).optional().catch(undefined),
	category: z.enum(starterTemplateCategories).optional().catch(undefined),
});

/** Search params of `/templates` after validation. Every field is optional. */
export type TemplatesSearch = z.infer<typeof templatesSearchSchema>;
