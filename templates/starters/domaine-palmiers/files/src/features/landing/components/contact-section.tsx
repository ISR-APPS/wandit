// The last section: how to ask for a private visit, and the details of the sales office.
// LandingPage renders it on the second ground. Its id "contact" is the target of the header link and of the hero button.
// The left column holds the visit request and the plate that says what happens next. The right column holds the office ledger and one photo.
// No block of this section has a scroll reveal: the main button of the page jumps here, and the visitor must see it at once.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BODY,
	CAPTION,
	H2,
	H3,
	RULE_LABEL,
	SECTION,
	WRAP,
} from "../lib/type-styles";
import { Aperture } from "./aperture";
import { Ledger } from "./ledger";
import { VisitRequest } from "./visit-request";

/** A split of 7 to 5 from 1024px. The telephone and the email of the ledger are links. */
export function ContactSection() {
	const { t } = useT();
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			className={cn(SECTION, "scroll-mt-16 bg-canvas")}
		>
			<div
				className={cn(
					WRAP,
					"grid gap-[clamp(2.4rem,4vw,4.5rem)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start",
				)}
			>
				<div>
					<div>
						<p className={RULE_LABEL}>{t("contact.label")}</p>
						<h2
							id="contact-title"
							className={cn(H2, "mt-[clamp(1.2rem,2vw,1.8rem)]")}
						>
							<span className="block">{t("contact.titleLine1")}</span>
							<span className="block">{t("contact.titleLine2")}</span>
						</h2>
						<p className={cn(BODY, "mt-[clamp(1.2rem,2vw,1.6rem)]")}>
							{t("contact.body")}
						</p>
					</div>
					<VisitRequest />
					<div className="mt-[clamp(2rem,3vw,2.8rem)] max-w-[560px] border border-foreground/24 bg-background p-[clamp(1.4rem,2.6vw,2rem)]">
						<h3 className={H3}>{t("contact.nextTitle")}</h3>
						<p className="mt-[0.7rem] max-w-[46ch] text-[0.98rem] text-foreground/75 leading-[1.7]">
							{t("contact.nextBody")}
						</p>
					</div>
				</div>
				<div>
					<div>
						<p className={RULE_LABEL}>{t("contact.officeLabel")}</p>
						<Ledger
							layout="split"
							className="mt-[clamp(1.6rem,2.6vw,2.4rem)]"
							rows={[
								{
									label: t("contact.addressLabel"),
									value: t("contact.addressValue"),
								},
								{
									label: t("contact.phoneLabel"),
									value: t("site.phoneDisplay"),
									href: t("site.phoneHref"),
								},
								{
									label: t("contact.emailLabel"),
									value: t("contact.emailValue"),
									href: t("contact.emailHref"),
								},
								{
									label: t("contact.visitsLabel"),
									value: t("contact.visitsValue"),
								},
								{
									label: t("contact.officeHoursLabel"),
									value: t("contact.officeHoursValue"),
								},
							]}
						/>
					</div>
					<Aperture
						src="/images/terrace.webp"
						alt={t("contact.imageAlt")}
						width={1600}
						height={900}
						isStill
						className="mt-[clamp(2.2rem,3.4vw,3rem)] aspect-[4/3]"
					/>
					<p
						className={cn(
							CAPTION,
							"mt-[0.9rem] border-foreground/12 border-t pt-[0.8rem]",
						)}
					>
						{/* The rule is as wide as the photo. Only the text has a measure. */}
						<span className="block max-w-[38ch]">
							{t("contact.imageCaption")}
						</span>
					</p>
				</div>
			</div>
		</section>
	);
}
