// Movement 05, "Contact": the closing ledger. LandingPage renders it on the pale steel ground.
// The coordinates are hairline rows at the start side, with a short access note. The request is at the end side.
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MICRO, MOVEMENT, SECTION_TITLE, SOFT } from "../lib/type-styles";
import { EmailText } from "./email-text";
import { MeetingBrief } from "./meeting-brief";
import { SectionLabel } from "./section-label";

// A text link of the ledger. On a phone it has a touch height of 44px.
const LEDGER_LINK =
	"inline-flex min-h-11 items-center underline decoration-foreground/25 underline-offset-[6px] transition-colors duration-[180ms] ease-linear hover:text-primary hover:decoration-primary min-[56.25rem]:min-h-0";

/** The coordinates of the firm and the first-meeting request, side by side from 900px. */
export function ContactSection() {
	const { t } = useT();
	const rows: { term: string; value: ReactNode }[] = [
		{
			term: t("contact.addressLabel"),
			value: (
				<>
					{t("contact.addressLine1")}
					<br />
					{t("contact.addressLine2")}
				</>
			),
		},
		{
			term: t("contact.phoneLabel"),
			value: (
				<a
					href={t("site.phoneHref")}
					className={cn(LEDGER_LINK, "tabular-nums")}
				>
					{t("site.phoneDisplay")}
				</a>
			),
		},
		{
			term: t("contact.emailLabel"),
			value: (
				<a href={`mailto:${t("site.email")}`} className={LEDGER_LINK}>
					{/* One flex item: else the inline-flex link splits the address at the <wbr>. */}
					<span>
						<EmailText />
					</span>
				</a>
			),
		},
		{ term: t("contact.hoursLabel"), value: t("contact.hoursValue") },
		{ term: t("contact.feesLabel"), value: t("contact.feesValue") },
	];
	return (
		<section id="contact" data-movement className={cn(MOVEMENT, "cap-steel")}>
			<div className="cap-wrap">
				<SectionLabel data-reveal className="mb-[1.4rem]">
					{t("contact.label")}
				</SectionLabel>
				<h2 data-reveal className={cn(SECTION_TITLE, "max-w-[24ch]")}>
					{t("contact.title")}
				</h2>
				<div className="mt-[clamp(2rem,4vh,3rem)] grid grid-cols-1 gap-[clamp(2.4rem,4vw,3.5rem)] min-[56.25rem]:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] min-[56.25rem]:gap-[clamp(2.5rem,5vw,4.5rem)]">
					<div data-reveal>
						<dl className="border-foreground/18 border-t">
							{rows.map((row) => (
								<div
									key={row.term}
									className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-baseline gap-4 border-foreground/12 border-b py-4"
								>
									<dt className={cn(MICRO, "text-primary")}>{row.term}</dt>
									<dd className="text-[0.96875rem]">{row.value}</dd>
								</div>
							))}
						</dl>
						<div className="mt-[clamp(1.8rem,3.5vh,2.6rem)]">
							<SectionLabel className="mb-3">
								{t("contact.accessLabel")}
							</SectionLabel>
							<p className={cn(SOFT, "max-w-[40ch] text-[0.90625rem]")}>
								{t("contact.accessText")}
							</p>
							<p className="mt-4 border-foreground/12 border-t pt-4 text-[0.9375rem]">
								<span className="me-2 align-[-0.15em] font-display text-[2.1rem] leading-none">
									{t("contact.accessFigure")}
								</span>
								{t("contact.accessFigureText")}
							</p>
						</div>
					</div>
					<div
						data-reveal
						className="border-foreground/18 border-t pt-[clamp(2rem,6vw,2.6rem)] min-[56.25rem]:border-foreground/12 min-[56.25rem]:border-s min-[56.25rem]:border-t-0 min-[56.25rem]:ps-[clamp(2rem,4vw,3.5rem)] min-[56.25rem]:pt-0"
					>
						<MeetingBrief />
					</div>
				</div>
			</div>
		</section>
	);
}
