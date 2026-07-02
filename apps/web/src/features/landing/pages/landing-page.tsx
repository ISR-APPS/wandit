import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthModal } from "@/features/auth";

import { CtaBand } from "../components/cta-band";
import { Examples } from "../components/examples";
import { Faq } from "../components/faq";
import { FeaturesBento } from "../components/features-bento";
import { Hero } from "../components/hero";
import { HowItWorks } from "../components/how-it-works";
import { LandingFooter } from "../components/landing-footer";
import { LandingNav } from "../components/landing-nav";
import { Pricing } from "../components/pricing";
import { scrollToTop } from "../lib/scroll";

const route = getRouteApi("/");

export default function LandingPage() {
	const search = route.useSearch();
	const { open } = useAuthModal();

	// Remount the PromptBox with a fresh key to prefill it programmatically.
	const [prefill, setPrefill] = useState({ key: 0, value: "" });
	const autoOpenedRef = useRef(false);

	// The _auth guard redirects here with ?auth=required — open the modal once.
	useEffect(() => {
		if (!search.auth || autoOpenedRef.current) return;
		autoOpenedRef.current = true;
		open();
	}, [search.auth, open]);

	const prefillPrompt = useCallback((value: string, scroll = false) => {
		setPrefill((prev) => ({ key: prev.key + 1, value }));
		if (scroll) scrollToTop();
	}, []);

	return (
		<div className="min-h-svh bg-background">
			<LandingNav />
			<main>
				<Hero promptKey={prefill.key} promptInitial={prefill.value} />
				<HowItWorks />
				<Examples onUseExample={(prompt) => prefillPrompt(prompt, true)} />
				<FeaturesBento />
				<Pricing />
				<Faq />
				<CtaBand />
			</main>
			<LandingFooter />
		</div>
	);
}
