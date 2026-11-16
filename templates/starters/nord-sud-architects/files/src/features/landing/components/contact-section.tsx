// PL·07, the closing section: the studio details on the start side, the study request sheet on the end side.
// LandingPage renders it last, before the footer title block. The red visa sits under the details.
// The telephone, the email, and the address are fictional; they live in the `site` group of messages.ts.
import { useT } from "~/shared/i18n";
import { BODY, LABEL, SECTION } from "../lib/styles";
import { RedVisa } from "./red-visa";
import { SectionHead } from "./section-head";
import { StudyRequest } from "./study-request";

/** A 5/7 split from 1024px. On a phone the details come first, then the sheet. */
export function ContactSection() {
	const { t } = useT();
	// The after layer grows the touch area to about 46px inside the row padding, with no change of the layout.
	const linkClass =
		"relative border-foreground/35 border-b after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] transition-colors duration-150 ease-linear hover:border-foreground focus-visible:border-foreground";
	const lines = [
		{ label: t("contact.addressLabel"), value: t("site.address") },
		{
			label: t("contact.phoneLabel"),
			value: (
				<a href={t("site.phoneHref")} className={`${linkClass} tabular-nums`}>
					{t("site.phoneDisplay")}
				</a>
			),
		},
		{
			label: t("contact.emailLabel"),
			value: (
				<a href={t("site.emailHref")} className={linkClass}>
					{t("site.email")}
				</a>
			),
		},
		{ label: t("contact.hoursLabel"), value: t("contact.hours") },
	];
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			className={`${SECTION} ns-paper-2 border-foreground/15 border-t`}
		>
			<div className="ns-wrap">
				<SectionHead
					folio="contact.folio"
					title="contact.title"
					titleId="contact-title"
				/>
				<div className="grid items-start gap-12 lg:grid-cols-[5fr_7fr] lg:gap-[clamp(2.5rem,6vw,5rem)]">
					{/* From 1024px the column is as tall as the request sheet. The visa then stamps its bottom corner. */}
					<div
						data-reveal
						className="ns-rise flex min-w-0 flex-col lg:self-stretch"
					>
						<p className={`${LABEL} mb-3 font-normal text-foreground/70`}>
							{t("contact.kicker")}
						</p>
						<dl>
							{lines.map((line) => (
								<div
									key={line.label}
									className="flex items-baseline gap-4 border-foreground/20 border-b py-3.5"
								>
									<dt
										className={`${LABEL} w-24 shrink-0 font-normal text-foreground/60`}
									>
										{line.label}
									</dt>
									<dd className="min-w-0 break-words">{line.value}</dd>
								</div>
							))}
						</dl>
						<p
							className={`${BODY} mt-6 max-w-[40ch] text-[0.95rem] leading-[1.6]`}
						>
							{t("contact.dryLine")}
						</p>
						<div className="mt-8 lg:mt-auto lg:pt-8">
							<RedVisa />
						</div>
					</div>
					<StudyRequest />
				</div>
			</div>
		</section>
	);
}
