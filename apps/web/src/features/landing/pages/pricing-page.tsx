/**
 * The public pricing page at `/pricing`. The route file routes/pricing.tsx renders it.
 * It uses the nav and the footer of the home page. It reports the
 * "pricing viewed" product event, which the emitter sends once per browser session.
 */

import { MotionConfig } from "motion/react";
import { useEffect } from "react";

import { useSession } from "@/features/auth";
import {
	emitPricingViewed,
	getProductEventSessionState,
} from "@/features/product-events";

import { Pricing } from "../components/pricing";
import { SiteFooter } from "../components/site-footer";
import { SiteNav } from "../components/site-nav";

export default function PricingPage() {
	const { data: session, isPending: isSessionPending } = useSession();
	const sessionUserId = session?.user.id;
	const sessionState = getProductEventSessionState(
		isSessionPending,
		sessionUserId,
	);

	useEffect(() => {
		emitPricingViewed("marketing_pricing", sessionState);
	}, [sessionState]);

	return (
		<MotionConfig reducedMotion="user">
			<div className="min-h-svh bg-paper font-grotesk text-night antialiased">
				<SiteNav />
				<main>
					<Pricing />
				</main>
				<SiteFooter />
			</div>
		</MotionConfig>
	);
}
