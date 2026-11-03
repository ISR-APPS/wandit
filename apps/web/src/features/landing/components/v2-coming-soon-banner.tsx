/**
 * The night strip that announces V2 at the top of the page. SiteNav renders
 * it above the landing and pricing bar. The dashboard page gets it through
 * the landing barrel. Its link goes to the pricing page, because subscribers
 * get V2 first. The pricing page shows no link.
 */

import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@wandit/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";

import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";

/** Delete it when V2 opens on production. On a phone the text wraps to a few lines. */
export function V2ComingSoonBanner({ className }: { className?: string }) {
	const { t } = useTranslation();
	const pathname = useLocation({ select: (location) => location.pathname });
	return (
		<div className={cn("bg-night px-4 py-2 text-paper", className)}>
			{/* Inline flow, not flex: the link can then stay on the last text line. */}
			<p className="mx-auto max-w-7xl text-balance text-center text-xs leading-relaxed md:text-sm">
				<Spark className="me-1.5 inline-block size-3.5 align-[-2px] text-spark" />
				<span className="font-semibold">{t("landing.v2Banner.title")}</span>{" "}
				<span className="text-paper/75">{t("landing.v2Banner.body")}</span>{" "}
				{/* On the pricing page the plans are already below, so the link would go nowhere. */}
				{pathname === "/pricing" ? null : (
					<Link
						to="/pricing"
						className="inline-flex items-center gap-1 rounded-sm font-semibold text-spark underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-spark"
					>
						{t("landing.v2Banner.cta")}
						<ArrowRightIcon aria-hidden className="size-3.5 rtl:rotate-180" />
					</Link>
				)}
			</p>
		</div>
	);
}
