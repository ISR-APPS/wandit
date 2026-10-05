/**
 * The marketing page at `/`. The route file routes/index.tsx renders it.
 * It opens the auth modal for the `?auth=` redirects, scrolls to a `/#section`
 * deep link, and passes an idea from the ideas wall into the hero prompt box.
 */

import { getRouteApi, useLocation } from "@tanstack/react-router";
import type { TargetPlatform } from "@wandit/contracts";
import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { promptStash, useAuthModal } from "@/features/auth";
import { useTranslation } from "@/lib/i18n";

import { AppLayers } from "../components/app-layers";
import { ClosingCta } from "../components/closing-cta";
import { Faq } from "../components/faq";
import { Hero, type HeroPrefill } from "../components/hero";
import { HowItWorks } from "../components/how-it-works";
import { Ideas } from "../components/ideas";
import { Languages } from "../components/languages";
import { SiteFooter } from "../components/site-footer";
import { SiteNav } from "../components/site-nav";
import { scrollToId, scrollToTop } from "../lib/scroll";

const route = getRouteApi("/");

export default function LandingPage() {
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const { open } = useAuthModal();
	const { t } = useTranslation();
	const autoOpenedRef = useRef(false);
	const [heroPrefill, setHeroPrefill] = useState<HeroPrefill | null>(null);

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

	const applyIdea = useCallback((platform: TargetPlatform, text: string) => {
		setHeroPrefill((prev) => ({ key: (prev?.key ?? 0) + 1, platform, text }));
		scrollToTop();
	}, []);

	// Section links on other pages (e.g. /pricing) land here as /#section.
	const hash = useLocation({ select: (location) => location.hash });
	useEffect(() => {
		if (hash) scrollToId(hash.replace(/^#/, ""));
	}, [hash]);

	return (
		<MotionConfig reducedMotion="user">
			<div className="min-h-svh bg-paper font-grotesk text-night antialiased">
				<SiteNav />
				<main>
					<Hero prefill={heroPrefill} />
					<HowItWorks />
					<AppLayers />
					<Languages />
					<Ideas onUseIdea={applyIdea} />
					<Faq />
					<ClosingCta />
				</main>
				<SiteFooter />
			</div>
		</MotionConfig>
	);
}
