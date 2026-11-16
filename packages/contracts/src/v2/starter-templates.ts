/**
 * Vocabulary of the V2 starter templates: the kinds, the categories, and the entry schema.
 * The `/templates` search schema reads it. The entries are in `starter-template-catalog.ts`,
 * so a page that reads only these lists does not load the 50 entries.
 * `src/index.ts` exports it, so the web entry gets these short lists from the barrel it already loads.
 */
import { z } from "zod";
import { starterTemplateIdSchema } from "../v1/shared/primitives";

/** `website`: the public pages are the value. `app`: the pages behind sign-in are the value. */
export const starterTemplateKinds = ["website", "app"] as const;

/** `website` or `app`; see `starterTemplateKinds`. */
export type StarterTemplateKind = (typeof starterTemplateKinds)[number];

/** The business categories of the `/templates` filter. The web shows only the ones that have a starter template. */
export const starterTemplateCategories = [
	"analytics",
	"crm",
	"ecommerce",
	"finance",
	"health",
	"hospitality",
	"real-estate",
	"logistics",
	"education",
	"productivity",
	"sales",
	"hr",
	"food",
	"fitness",
	"marketing",
	"support",
	"inventory",
	"legal",
	"agency",
	"events",
	"travel",
	"beauty",
	"interior",
	"portfolio",
	"saas",
	"services",
] as const;

/** One category of `starterTemplateCategories`. */
export type StarterTemplateCategory =
	(typeof starterTemplateCategories)[number];

// One text in the three UI languages of wandit.
const localizedTextSchema = z.object({
	en: z.string().min(1),
	fr: z.string().min(1),
	ar: z.string().min(1),
});

// The card has one line for the subtitle. 60 characters fit in it in each language.
const taglineTextSchema = z.string().min(1).max(60);

/** Validator of one catalog entry. A spec parses every entry of `STARTER_TEMPLATES` with it. */
export const starterTemplateSchema = z.object({
	// Folder name under `templates/starters` and under `apps/web/public/starter-templates`.
	id: starterTemplateIdSchema,
	kind: z.enum(starterTemplateKinds),
	// Brand-like name. Not translated. It becomes the project name.
	name: z.string().min(1),
	category: z.enum(starterTemplateCategories),
	// Card subtitle, at most 60 characters per language.
	tagline: z.object({
		en: taglineTextSchema,
		fr: taglineTextSchema,
		ar: taglineTextSchema,
	}),
	// One or two sentences for the detail page.
	description: localizedTextSchema,
	// Light or dark base of the starter template. The card frame reads it.
	mode: z.enum(["light", "dark"]),
	// Count of gallery images `shot-1.webp` to `shot-N.webp`, 0 to 3. `cover.webp` always exists.
	shots: z.int().min(0).max(3),
});

/** One starter template of the catalog. The images are static files; the web builds their URLs from `id`. */
export type StarterTemplate = z.infer<typeof starterTemplateSchema>;
