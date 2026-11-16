// The closing section: the promise of a setup call on a sky pool, and a floating card with the contact details.
// LandingPage renders it. The card posts no data: its two actions are a `tel:` link and a `mailto:` link.
// STARTER.md says how to put a real call-back form in the card.
import { useT } from "~/shared/i18n";
import { BLOCK_TITLE, LEAD, TRUST_LINE, WRAP } from "../lib/class-names";
import { LabelPill } from "./label-pill";
import { PillLink } from "./pill-link";
import { SpotIllustration } from "./spot-illustration";

// One row of the card: a small label, then its value. Under 640px the value goes under the label.
// Every row has the same minimum height, so the four rows of the card are even.
const ROW =
	"flex min-h-[4.25rem] flex-col items-start justify-center gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4";
const ROW_LABEL = "font-semibold text-[0.83rem] text-muted-foreground";
const ROW_VALUE = "font-medium text-[0.95rem]";

/** The telephone number and the email address are sample details from the `site` group of messages.ts. */
export function ContactSection() {
	const { t } = useT();
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			className="pt-[clamp(1rem,3vh,2.5rem)] pb-[clamp(4rem,8vh,6rem)]"
		>
			<div className={WRAP}>
				<div className="grid items-center gap-[clamp(2.2rem,5vw,4rem)] rounded-[calc(var(--radius)*1.75)] bg-(--fw-sky-soft) px-[clamp(1.25rem,5vw,4rem)] pt-[clamp(2.25rem,5vw,4rem)] pb-[clamp(3rem,5vw,4rem)] lg:grid-cols-[1.05fr_1fr]">
					<div>
						<LabelPill>{t("contact.label")}</LabelPill>
						<h2
							id="contact-title"
							data-reveal
							className="mt-5 text-balance font-display font-extrabold text-[clamp(1.9rem,3.4vw,2.7rem)] leading-[1.14] tracking-[-0.02em]"
						>
							{t("contact.title")}
						</h2>
						<p
							data-reveal
							className={`${LEAD} mt-5 max-w-[30em] [--fw-delay:60ms]`}
						>
							{t("contact.lead")}
						</p>
						<figure
							data-reveal
							className="mt-7 flex items-center gap-4 [--fw-delay:120ms]"
						>
							<SpotIllustration
								scene="reply"
								label={t("contact.spotLabel")}
								panelTone="paper"
								className="w-[132px] shrink-0 sm:w-[168px]"
							/>
							<figcaption className="max-w-[13em] text-[0.9rem] text-muted-foreground leading-normal">
								{t("contact.spotCaption")}
							</figcaption>
						</figure>
					</div>

					<div data-reveal>
						<div className="fw-card p-[clamp(1.4rem,3vw,2.2rem)]">
							<h3 className={`${BLOCK_TITLE} text-[1.25rem]`}>
								{t("contact.cardTitle")}
							</h3>
							<dl className="mt-3 divide-y divide-foreground/8">
								<div className={ROW}>
									<dt className={ROW_LABEL}>{t("contact.phoneLabel")}</dt>
									<dd>
										<a
											href={t("site.phoneHref")}
											className="inline-flex min-h-11 items-center gap-2 tabular-nums"
										>
											{/* The country prefix is a chip, as in the telephone field of the product. */}
											<span className="rounded-md bg-accent px-1.5 py-0.5 font-semibold text-(--fw-blue-deep) text-[0.8rem]">
												{t("site.phonePrefix")}
											</span>
											<span className={ROW_VALUE}>
												{t("site.phoneDisplay")}
											</span>
										</a>
									</dd>
								</div>
								<div className={ROW}>
									<dt className={ROW_LABEL}>{t("contact.emailLabel")}</dt>
									<dd>
										<a
											href={t("site.emailHref")}
											className={`${ROW_VALUE} inline-flex min-h-11 items-center text-primary`}
										>
											{t("site.email")}
										</a>
									</dd>
								</div>
								<div className={ROW}>
									<dt className={ROW_LABEL}>{t("contact.hoursLabel")}</dt>
									<dd
										className={`${ROW_VALUE} inline-flex min-h-11 items-center`}
									>
										{t("contact.hoursValue")}
									</dd>
								</div>
								<div className={ROW}>
									<dt className={ROW_LABEL}>{t("contact.setupLabel")}</dt>
									<dd
										className={`${ROW_VALUE} inline-flex min-h-11 items-center`}
									>
										{t("contact.setupValue")}
									</dd>
								</div>
							</dl>
							<div className="mt-5 grid gap-3">
								<PillLink href={t("site.phoneHref")} tone="primary">
									{t("contact.callCta")}
								</PillLink>
								<PillLink href={t("site.emailHref")} tone="secondary">
									{t("contact.writeCta")}
								</PillLink>
							</div>
							<p className={`${TRUST_LINE} mt-4 text-balance text-center`}>
								{t("contact.trust")}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
