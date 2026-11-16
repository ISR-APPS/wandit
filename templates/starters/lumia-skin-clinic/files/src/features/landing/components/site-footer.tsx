// The quiet footer of the home page: the small serif wordmark, two credential capsules, and the copyright line.
// LandingPage renders it on the deeper cream, under one cacao hairline. No credit line.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { GUTTER, WRAP } from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";

/** The <footer>. Three columns on a wide screen, one column on a phone. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className={cn("bg-(--lumia-cream-deep) pb-[2.3rem]", GUTTER)}>
			<div
				className={cn(
					WRAP,
					"grid items-center gap-6 border-(--lumia-hair) border-t pt-8 md:grid-cols-[1fr_auto] lg:grid-cols-[minmax(160px,1fr)_auto_minmax(160px,1fr)]",
				)}
			>
				<span className="font-display text-[1.35rem] leading-none">
					{t("site.brand")}
				</span>
				<ul
					aria-label={t("footer.credentialsLabel")}
					className="m-0 flex list-none flex-wrap gap-2 p-0 md:col-span-2 md:row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center"
				>
					<li>
						<CapsuleBadge tone="cream">{t("site.badgeLicensed")}</CapsuleBadge>
					</li>
					<li>
						<CapsuleBadge tone="cream">{t("site.badgeSince")}</CapsuleBadge>
					</li>
				</ul>
				<p className="text-(--lumia-ink-soft) text-[13px] md:justify-self-end">
					{t("footer.copyright")}
				</p>
			</div>
		</footer>
	);
}
