// The closing section of the home page: the reply card, centred on the ivory ground.
// LandingPage renders it before the footer. Petals drift in its gutters (data-scrub="pass").
// The card has its own scrub value, so it draws itself on its own schedule.
import { SECTION, WRAP } from "../lib/type-styles";
import { PetalLayer } from "./petal-layer";
import { ReplyCard } from "./reply-card";

/** The section around the card. The card is the only centred block of the page. */
export function ReplySection() {
	return (
		<section
			id="reply"
			aria-labelledby="reply-title"
			data-scrub="pass"
			className={`${SECTION} relative overflow-hidden`}
		>
			<PetalLayer count={3} />
			<div className={`${WRAP} relative`}>
				<ReplyCard />
			</div>
		</section>
	);
}
