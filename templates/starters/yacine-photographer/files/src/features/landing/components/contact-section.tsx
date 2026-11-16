// Section 06: the contact details of the studio and the booking slip.
// landing-page.tsx renders it. It reads the "contact" group of messages.ts.
// The details are fictional sample content; the links open the phone and the mail app of the visitor.
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { H2, KICKER, LABEL, WRAP } from "../lib/styles";
import { CutGroup } from "./cut-group";
import { MessageSlip } from "./message-slip";

// The link is 44px high for a thumb, so a linked fact takes less padding than a plain one.
const FACT_LINK =
	"inline-flex min-h-11 items-center hover:text-primary focus-visible:text-primary";

/** One line of the facts column. `href` is a tel: or mailto: link; a fact without it is plain text. */
type ContactFact = { label: string; value: ReactNode; href?: string };

/** The closing section, on the panel: a mono facts column beside the slip. */
export function ContactSection() {
	const { t } = useT();
	const facts: ContactFact[] = [
		{
			label: t("contact.studioLabel"),
			value: (
				<>
					{t("contact.studioLine1")}
					<br />
					{t("contact.studioLine2")}
				</>
			),
		},
		{
			label: t("contact.phoneLabel"),
			// dir="ltr": the digit groups of the number keep their order in a right-to-left language.
			value: <span dir="ltr">{t("site.phone")}</span>,
			href: t("site.phoneHref"),
		},
		{
			label: t("contact.emailLabel"),
			value: t("contact.email"),
			href: t("contact.emailHref"),
		},
		{ label: t("contact.replyLabel"), value: t("contact.replyValue") },
		{ label: t("contact.travelLabel"), value: t("contact.travelValue") },
	];
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			className="border-foreground/15 border-t bg-card py-(--yr-section)"
		>
			<div className={WRAP}>
				<CutGroup className="pb-[clamp(2rem,4vh,3.2rem)]">
					<p className={`${KICKER} yr-cut`}>{t("contact.kicker")}</p>
					<h2 id="contact-title" className={`${H2} yr-cut mt-3.5 [--cut:1]`}>
						<span className="block">{t("contact.titleLine1")}</span>
						<span className="block">{t("contact.titleLine2")}</span>
					</h2>
				</CutGroup>

				<CutGroup className="grid items-start gap-[34px] min-[881px]:grid-cols-[clamp(220px,25vw,330px)_minmax(0,1fr)] min-[881px]:gap-[clamp(26px,4vw,64px)]">
					<dl className="yr-cut border-foreground/15 border-t">
						{facts.map((fact) => (
							<div
								key={fact.label}
								className={cn(
									"border-foreground/15 border-b",
									fact.href ? "pt-[13px] pb-0.5" : "py-[13px]",
								)}
							>
								<dt className={LABEL}>{fact.label}</dt>
								{fact.href ? (
									<dd className="text-[0.98rem]">
										<a href={fact.href} className={FACT_LINK}>
											<span className="border-foreground/30 border-b">
												{fact.value}
											</span>
										</a>
									</dd>
								) : (
									<dd className="mt-1.5 text-[0.98rem] leading-[1.5]">
										{fact.value}
									</dd>
								)}
							</div>
						))}
					</dl>
					<MessageSlip />
				</CutGroup>
			</div>
		</section>
	);
}
