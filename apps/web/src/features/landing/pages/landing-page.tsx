import { getRouteApi } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { promptStash, useAuthModal } from "@/features/auth";
import { useTranslation } from "@/lib/i18n";

import { CtaBand } from "../components/cta-band";
import { Examples } from "../components/examples";
import { Faq } from "../components/faq";
import { FeaturesBento } from "../components/features-bento";
import { Hero } from "../components/hero";
import { InAction } from "../components/in-action";
import { LandingFooter } from "../components/landing-footer";
import { LandingNav } from "../components/landing-nav";
import { Pricing } from "../components/pricing";
import { Problem } from "../components/problem";
import { ProofBar } from "../components/proof-bar";
import { scrollToTop } from "../lib/scroll";

const route = getRouteApi("/");

export default function LandingPage() {
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const { open } = useAuthModal();
	const { t } = useTranslation();

	// Remount the PromptBox with a fresh key to prefill it programmatically.
	const [prefill, setPrefill] = useState({ key: 0, value: "" });
	const autoOpenedRef = useRef(false);

	// The _auth guard redirects here with ?auth=required (or Better Auth with
	// ?auth=error) — open the modal once, then strip consumed auth state.
	useEffect(() => {
		if (
			(search.auth !== "required" && search.auth !== "error") ||
			autoOpenedRef.current
		) {
			return;
		}

		autoOpenedRef.current = true;
		if (search.auth === "error") {
			promptStash.consume();
			toast.error(t("auth.redirectError"));
		}
		open({ next: search.next, redirectError: search.auth === "error" });
		void navigate({ search: {}, replace: true });
	}, [search.auth, search.next, open, navigate, t]);

	const prefillPrompt = useCallback((value: string, scroll = false) => {
		setPrefill((prev) => ({ key: prev.key + 1, value }));
		if (scroll) scrollToTop();
	}, []);

	return (
		<MotionConfig reducedMotion="user">
			<div className="min-h-svh bg-background">
				<LandingNav />
				<main>
					<Hero promptKey={prefill.key} promptInitial={prefill.value} />
					<InAction />
					<ProofBar />
					<Problem />
					<Examples onUseExample={(prompt) => prefillPrompt(prompt, true)} />
					<FeaturesBento />
					<Pricing />
					<Faq />
					<CtaBand />
				</main>
				<LandingFooter />
			</div>
		</MotionConfig>
	);
}
