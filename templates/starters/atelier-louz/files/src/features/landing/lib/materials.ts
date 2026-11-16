// The six materials of the material library, in cabinet order.
// MaterialsSection draws one swatch for each; LandingPage puts the chosen id on the page root.
// landing.css maps each id (the data-material attribute) to its room colors and its page tint.

/** Cabinet order. The first one is the material of the page at load, before any click. */
export const MATERIAL_IDS = [
	"tadelakt",
	"zellige",
	"walnut",
	"alfa",
	"brass",
	"linen",
] as const;

/** The id of one material. It is also the value of `data-material` on the page root. */
export type MaterialId = (typeof MATERIAL_IDS)[number];

/** The material the page shows before the visitor picks one. landing.css gives the same colors to `.louz`. */
export const DEFAULT_MATERIAL: MaterialId = "tadelakt";
