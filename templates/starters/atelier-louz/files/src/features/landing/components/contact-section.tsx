// The fixed closing: a large arch frame with three numbered ways to reach the studio and one main action.
// LandingPage renders it before the footer. It posts no data: the actions are a tel: link and a mailto: link.
import { useT } from "~/shared/i18n";
import { ArchGlyph } from "./arch-glyph";
import { ArchTag } from "./arch-tag";

/** The contact frame. STARTER.md names this file as the place for a real booking form. */
export function ContactSection() {
	const { t } = useT();
	const ways = [
		{
			step: t("contact.callStep"),
			value: t("site.phoneDisplay"),
			href: t("site.phoneHref"),
			body: t("contact.callBody"),
		},
		{
			step: t("contact.writeStep"),
			value: t("site.email"),
			href: t("site.emailHref"),
			body: t("contact.writeBody"),
		},
		{
			step: t("contact.visitStep"),
			value: t("site.addressLine"),
			href: undefined,
			body: t("contact.visitBody"),
		},
	];
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			className="louz-section"
		>
			<div className="mx-auto max-w-[1340px] px-5 sm:px-8">
				<div
					data-reveal
					className="louz-frame-arch louz-sand mx-auto max-w-[860px] border-2 border-foreground/70 px-5 pt-[clamp(4.5rem,12vw,7.5rem)] pb-[clamp(2.2rem,4vw,3rem)] text-center sm:px-[clamp(1.4rem,6vw,4.5rem)]"
				>
					<ArchGlyph className="mx-auto mb-6 h-8 w-11" />
					<ArchTag>{t("contact.tag")}</ArchTag>
					<h2
						id="contact-title"
						className="mt-4 mb-3 font-display font-normal text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.08]"
					>
						{t("contact.title")}
					</h2>
					<p className="mx-auto mb-10 max-w-[44ch] leading-relaxed">
						{t("contact.intro")}
					</p>
					<ol className="grid gap-3 text-start md:grid-cols-3">
						{ways.map((way, index) => (
							<li
								key={way.step}
								className="rounded-t-(--louz-foot-lg) rounded-b-(--louz-foot-sm) border-[1.6px] border-foreground/40 bg-background px-4 pt-3.5 pb-4"
							>
								<p className="mb-2 flex items-center gap-2 font-bold text-[0.78rem] uppercase tracking-[0.06em]">
									<span className="louz-tint-text tabular-nums">
										{String(index + 1).padStart(2, "0")}
									</span>
									{way.step}
								</p>
								{way.href === undefined ? (
									<p className="flex min-h-11 items-center font-display text-[1.1rem] leading-snug">
										{way.value}
									</p>
								) : (
									<a
										href={way.href}
										className="inline-flex min-h-11 items-center break-all font-display text-[1.1rem] leading-snug underline decoration-foreground/30 underline-offset-4 hover:decoration-current"
									>
										{way.value}
									</a>
								)}
								<p className="mt-1 text-pretty text-[0.88rem] text-foreground/75 leading-snug">
									{way.body}
								</p>
							</li>
						))}
					</ol>
					<div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
						<a
							href={t("site.emailHref")}
							className="louz-btn inline-flex min-h-14 w-full items-center justify-center px-8 pt-[0.15em] font-bold text-[1.02rem] sm:w-auto"
						>
							{t("contact.mainCta")}
						</a>
						<p className="max-w-[34ch] text-[0.88rem] text-foreground/75 sm:text-start">
							{t("contact.callBack")}
						</p>
					</div>
					<p className="mt-8 border-(--louz-hair) border-t pt-5 text-[0.92rem]">
						{t("contact.welcome")}
					</p>
				</div>
			</div>
		</section>
	);
}
