// The arrow at the end of a pill button. It moves 4px on hover through .lume-btn .lume-arrow in landing.css.
// The pills of the header, the hero, the noir chapter, the reserve section, and the footer render it.
import { ArrowRightIcon } from "~/shared/ui/icons";

/** A decorative arrow. It points to the end side, so it turns in Arabic. */
export function PillArrow() {
	return <ArrowRightIcon className="lume-arrow size-[1em] rtl:rotate-180" />;
}
