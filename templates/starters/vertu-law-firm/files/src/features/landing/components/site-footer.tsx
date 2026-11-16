// The footer: the firm name at monument scale over one brass rule, a four-column practical grid,
// then Art. 7, the legal notice that closes the numbered clauses of the page. LandingPage renders it on the recess ground.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";
import { ClauseHead } from "./clause-head";

/** The monument scale grows with the screen width, so the name fills the line on a 390px phone. */
export function SiteFooter() {
	const { t } = useT();
	const linkClass =
		"flex min-h-11 items-center py-1 text-(--vt-ink-70) lg:min-h-8 transition-colors hover:text-(--vt-brass)";
	const headingClass = cn(LABEL, "mb-3 text-(--vt-brass) text-[10.5px]");
	return (
		<footer className="vt-line border-t bg-(--vt-recess) pt-[clamp(3.5rem,7vh,5.5rem)] pb-10">
			<div className="vt-wrap">
				<p
					data-reveal
					className="vt-line border-b pb-[clamp(1.4rem,3vw,2.2rem)] font-display text-[clamp(2.2rem,11vw,7.5rem)] leading-none tracking-[-0.02em]"
				>
					{t("site.firmName")}
				</p>
				<div className="grid gap-x-5 gap-y-8 pt-8 text-[0.92rem] leading-relaxed sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<h2 className={headingClass}>{t("footer.officeLabel")}</h2>
						{/* The padding equals the offset of the link text in its touch row, so the first lines align. */}
						<p className="py-2.5 text-(--vt-ink-70) lg:py-1">
							{t("site.addressLine1")}
							<br />
							{t("site.addressLine2")}
						</p>
					</div>
					<div>
						<h2 className={headingClass}>{t("footer.contactLabel")}</h2>
						<a
							href={t("site.phoneHref")}
							className={cn(linkClass, "tabular-nums")}
						>
							{t("site.phoneDisplay")}
						</a>
						<a
							href={t("site.emailHref")}
							className={cn(linkClass, "break-all")}
						>
							{t("site.email")}
						</a>
					</div>
					<div>
						<h2 className={headingClass}>{t("footer.practicesLabel")}</h2>
						<a href="#practices" className={linkClass}>
							{t("footer.practicesLine1")}
						</a>
						<a href="#practices" className={linkClass}>
							{t("footer.practicesLine2")}
						</a>
					</div>
					<div>
						<h2 className={headingClass}>{t("footer.firmLabel")}</h2>
						<a href="#firm" className={linkClass}>
							{t("footer.rulesLink")}
						</a>
						<a href="#fees" className={linkClass}>
							{t("footer.feesLink")}
						</a>
					</div>
				</div>
				<div className="vt-faint mt-10 border-t pt-6">
					<ClauseHead article={7} size="small">
						{t("footer.mentionsTitle")}
					</ClauseHead>
					<p className="mt-2.5 max-w-[78ch] text-(--vt-ink-50) text-[0.8rem] leading-relaxed">
						{t("footer.mentionsBody")}
					</p>
				</div>
			</div>
		</footer>
	);
}
