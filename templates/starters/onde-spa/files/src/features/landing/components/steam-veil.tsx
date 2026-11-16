// A steam veil of the Onde world: a soft white band that breathes in a slow loop.
// The hero, the section seams, and the footer render it. landing.css draws each kind and each loop phase.
// It never ends on a hard edge: its gradient reaches alpha 0 inside its own box.

type SteamVeilProps = {
	/**
	 * "seam" straddles the top edge of its section, "head" lifts the top of the hero photo,
	 * and "glow" is the haze behind the footer wordmark.
	 */
	kind: "seam" | "head" | "glow";
	/** Loop phase. 0 is the base loop; landing.css gives 1 to 5 their own duration and delay. Two veils on one screen differ. */
	phase: 0 | 1 | 2 | 3 | 4 | 5;
};

/** An empty span with no pointer events. Its section must be `relative`. */
export function SteamVeil({ kind, phase }: SteamVeilProps) {
	return (
		<span
			aria-hidden="true"
			data-kind={kind}
			data-phase={phase}
			className="onde-veil"
		/>
	);
}
