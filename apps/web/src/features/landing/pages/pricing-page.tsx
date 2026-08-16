import { MotionConfig } from "motion/react";
import { useEffect } from "react";

import { useSession } from "@/features/auth";
import {
	emitPricingViewed,
	getProductEventSessionState,
} from "@/features/product-events";

import { LandingFooter } from "../components/landing-footer";
import { LandingNav } from "../components/landing-nav";
import { Pricing } from "../components/pricing";

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
			<div className="min-h-svh bg-background">
				<LandingNav />
				{/* The nav is fixed — clear its height so the section header shows. */}
				<main className="pt-14 md:pt-16">
					<Pricing />
				</main>
				<LandingFooter />
			</div>
		</MotionConfig>
	);
}
