import { MotionConfig } from "motion/react";

import { LandingFooter } from "../components/landing-footer";
import { LandingNav } from "../components/landing-nav";
import { Pricing } from "../components/pricing";

export default function PricingPage() {
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
