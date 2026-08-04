/**
 * A DESIGN WORLD is a complete visual universe written as one deep document —
 * philosophy, tokens, typography, chassis, hero forms, seams, motion identity,
 * components, voice, and its own ban list. The Brain picks ONE world per
 * website build; the builder receives the doc VERBATIM appended to its system
 * prompt. Worlds exist because fragment sampling (a palette here, a motion
 * vocab there) leaves composition to the model's defaults — a world leaves
 * nothing to guess.
 */
export interface DesignWorld {
	/** Hard exclusion — never offer for these businesses. */
	avoidFor?: string[];
	/** The full world bible, appended verbatim to the builder system prompt. */
	doc: string;
	energy: "loud" | "medium" | "quiet";
	id: string;
	/** Soft affinity — a hint for sampling, never a lock. */
	industries?: string[];
	/** Related visual family, used to keep COD world fusion coherent. */
	family?: string;
	/** COD worlds whose signatures combine cleanly with this one. */
	fusesWith?: string[];
	/** Which build type this world serves: websites, product dossiers, COD funnels, or both. */
	kind: "both" | "cod" | "product" | "website";
	mood: string[];
	name: string;
	/** Compact skin swatch used in COD candidate menus. */
	preview?: {
		ground: string;
		ink: string;
		accent: string;
		fontFamily: string;
		sampleWord: string;
	};
	priceFeel: "accessible" | "premium";
	/** One vivid sentence for candidate menus and user-facing taste questions. */
	tagline: string;
}
