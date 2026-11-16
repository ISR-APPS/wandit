// The private viewing section: the invitation with the title, the promise, and the direct contacts,
// next to the viewing note that writes the email. LandingPage renders it last, before the footer.
// The contacts are fictional sample details of the `site` group in messages.ts.
import { useT } from "~/shared/i18n";
import { AccentWords } from "./accent-words";
import { ViewingNote } from "./viewing-note";

/** The section with id "contact": a 1fr / 1.2fr grid on a wide screen, one column on a phone. */
export function ContactSection() {
	const { t } = useT();
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			className="mer-wrap scroll-mt-20 pt-[clamp(6rem,15vh,12rem)] pb-[clamp(5rem,10vh,8rem)]"
		>
			<div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-[clamp(3rem,7vw,8rem)]">
				<div data-reveal className="mer-rise">
					<p className="text-[0.6875rem] text-primary uppercase tracking-[0.22em]">
						{t("contact.eyebrow")}
					</p>
					<h2
						id="contact-title"
						className="mt-6 mb-7 max-w-[11em] font-display text-[clamp(2.2rem,4.2vw,4rem)] leading-[1.1] tracking-[-0.012em]"
					>
						<AccentWords
							start={t("contact.titleStart")}
							accent={t("contact.titleAccent")}
						/>
					</h2>
					<p className="max-w-[38ch] text-[0.9375rem] text-foreground/70 leading-[1.7]">
						{t("contact.body")}
					</p>
					<p className="mt-10 text-[0.65625rem] text-foreground/55 uppercase tracking-[0.2em]">
						{t("contact.orWrite")}
					</p>
					<a
						href={t("site.emailHref")}
						className="mt-2 inline-flex min-h-11 items-center border-primary/55 border-b font-display text-[1.25rem] text-foreground/85 italic transition-colors duration-300 hover:text-primary"
					>
						{t("site.email")}
					</a>
					<p className="mt-3">
						<a
							href={t("site.phoneHref")}
							className="inline-flex min-h-11 items-center text-[0.875rem] text-foreground/70 tabular-nums transition-colors duration-300 hover:text-primary"
						>
							{t("site.phone")} — {t("site.phoneCity")}
						</a>
					</p>
				</div>
				<ViewingNote />
			</div>
		</section>
	);
}
