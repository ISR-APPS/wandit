// The footer monument: the short brand name drawn as one SVG line across the page, then one ruled row of facts.
// LandingPage renders it last. The SVG text stretches to the full width at every screen size.
import { ArrowUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { FIGURES, LABEL, WRAP } from "../lib/type-styles";

/** Under 1024px the bottom padding leaves room for the fixed CallBar. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer
			className={cn(
				WRAP,
				"rn-monument pt-[clamp(40px,6vw,80px)] pb-24 lg:pb-6.5",
			)}
		>
			<svg
				viewBox="0 0 720 150"
				role="img"
				aria-label={t("site.brand")}
				className="block w-full overflow-visible"
			>
				<text
					x="0"
					y="140"
					textLength="718"
					lengthAdjust="spacingAndGlyphs"
					className="uppercase"
				>
					{t("site.brandShort")}
				</text>
			</svg>
			<div
				className={cn(
					LABEL,
					"mt-3.5 flex flex-wrap items-center justify-between gap-x-8.5 gap-y-1 border-foreground border-t-2 pt-3 text-[11px] leading-[1.7] tracking-[0.14em]",
				)}
			>
				<span>
					{t("footer.rights")} —{" "}
					<span className="text-primary">{t("footer.since")}</span>
				</span>
				<span>{t("footer.honest")}</span>
				<a
					href={t("site.phoneHref")}
					className={cn(
						FIGURES,
						"inline-flex min-h-11 items-center hover:text-primary",
					)}
				>
					{t("site.phoneDisplay")}
				</a>
				<a
					href="#top"
					className="inline-flex min-h-11 items-center gap-1.5 hover:text-primary"
				>
					{t("footer.backTop")}
					<ArrowUpIcon className="size-3.5" />
				</a>
			</div>
		</footer>
	);
}
