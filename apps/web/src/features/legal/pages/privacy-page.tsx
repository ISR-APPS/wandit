import { MotionConfig } from "motion/react";

import { LandingFooter } from "@/features/landing/components/landing-footer";
import { LandingNav } from "@/features/landing/components/landing-nav";
import { useDictionary } from "@/lib/i18n";

import { LegalDocument } from "../components/legal-document";

export default function PrivacyPage() {
	const legal = useDictionary().legal;

	return (
		<MotionConfig reducedMotion="user">
			<div className="min-h-svh bg-background">
				<LandingNav />
				{/* The nav is fixed — clear its height so the title shows. */}
				<main className="pt-14 md:pt-16">
					<LegalDocument
						content={legal.privacy}
						otherHref="/terms"
						otherLabel={legal.common.otherTerms}
					/>
				</main>
				<LandingFooter />
			</div>
		</MotionConfig>
	);
}
