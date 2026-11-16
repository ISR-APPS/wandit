// The monument footer: the studio facts, the giant serif wordmark across the content column, and the legal line.
// LandingPage renders it last. Two brass hairlines frame it; they are the one footer use of brass.
import { useT } from "~/shared/i18n";

/** The page footer. The giant wordmark is decorative; the first column names the studio for screen readers. */
export function SiteFooter() {
	const { t } = useT();
	const year = new Date().getFullYear();
	return (
		<footer className="louz-sand louz-brass-rule border-t">
			<div className="mx-auto grid max-w-[1340px] gap-6 px-5 pt-12 pb-10 text-[0.95rem] sm:grid-cols-3 sm:px-8 lg:pt-16">
				<p>
					<strong className="block font-bold">{t("footer.studio")}</strong>
					{t("site.addressLine")}
					<br />
					{t("site.addressCity")}
				</p>
				<p>
					<strong className="block font-bold">{t("footer.phone")}</strong>
					<a
						href={t("site.phoneHref")}
						className="inline-flex min-h-11 items-center underline decoration-foreground/30 underline-offset-4 hover:decoration-current sm:min-h-0"
					>
						{t("site.phoneDisplay")}
					</a>
					<br />
					<a
						href={t("site.emailHref")}
						className="inline-flex min-h-11 items-center underline decoration-foreground/30 underline-offset-4 hover:decoration-current sm:min-h-0"
					>
						{t("site.email")}
					</a>
				</p>
				<p>
					<strong className="block font-bold">{t("footer.hours")}</strong>
					{t("site.hours")}
				</p>
			</div>
			<p
				aria-hidden="true"
				className="louz-giant mx-auto max-w-[1340px] whitespace-nowrap px-5 pb-8 text-start font-display tracking-[-0.01em] sm:px-8"
			>
				{t("site.brand")}
			</p>
			<div className="louz-brass-rule border-t">
				<div className="mx-auto flex max-w-[1340px] flex-wrap justify-between gap-x-8 gap-y-2 px-5 py-4 text-[0.82rem] text-foreground/75 sm:px-8">
					{/* After New Year the year can differ from the build year. React then patches the text. */}
					<span suppressHydrationWarning>
						© {year} {t("footer.legal")}
					</span>
					<span>{t("footer.scope")}</span>
				</div>
			</div>
		</footer>
	);
}
