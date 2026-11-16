// Section 07, the brief: the closing ledger rail, then how to write to the studio and what happens next.
// LandingPage renders it. The header link "contact" jumps here.
// The section posts no data: its actions are a mailto link and a tel link. STARTER.md says where a real form goes.
import { useT } from "~/shared/i18n";
import {
	BAND,
	LEDGER_LABEL,
	MONO,
	PROSE,
	RULED_LINK,
	RULED_LINK_TEXT,
	WRAP,
} from "../lib/type-styles";
import { AccentDot } from "./accent-dot";
import { SectionHead } from "./section-head";

// The title of one of the two blocks: what the visitor writes, and what the studio does then.
// At 1024px a block is 280px wide. This size keeps the longer title on one line there.
const BLOCK_TITLE =
	"pt-[18px] pb-3.5 font-display font-medium text-[clamp(1.3rem,2vw,1.8rem)] leading-[1.1] tracking-[-0.03em]";
// One numbered row of the two blocks: the number, then a title over a detail.
const STEP_ROW = `${MONO} sable-row grid grid-cols-[44px_minmax(0,1fr)] gap-4 border-foreground/14 border-t py-[13px]`;
// One row of the studio details: the label at the start, the value at the end. 44px keeps the email link a touch target.
const CONTACT_ROW =
	"sable-row flex min-h-11 flex-wrap items-center justify-between gap-x-[18px] border-foreground/14 border-b";

/** The brief. The list "what to write" names the three lines of the email, so the visitor knows them before the click. */
export function BriefSection() {
	const { t } = useT();
	const railCells = [
		{ label: t("brief.railReply"), value: t("brief.railReplyValue") },
		{ label: t("brief.railBudget"), value: t("brief.railBudgetValue") },
		{ label: t("brief.railOpening"), value: t("brief.railOpeningValue") },
		{ label: t("brief.railPhone"), value: t("site.phone") },
	];
	// `number` is the place of the line in the email, two digits. Not translated.
	const lines = [
		{ number: "01", prompt: t("brief.line1"), hint: t("brief.line1Hint") },
		{ number: "02", prompt: t("brief.line2"), hint: t("brief.line2Hint") },
		{ number: "03", prompt: t("brief.line3"), hint: t("brief.line3Hint") },
	];
	const nextSteps = [
		{ number: "01", title: t("brief.next1"), detail: t("brief.next1Detail") },
		{ number: "02", title: t("brief.next2"), detail: t("brief.next2Detail") },
		{ number: "03", title: t("brief.next3"), detail: t("brief.next3Detail") },
	];
	return (
		<section
			id="contact"
			aria-labelledby="contact-title"
			data-cascade=""
			className={BAND}
		>
			<div className={WRAP}>
				<SectionHead label={t("brief.label")} />
				<dl className="sable-rail mb-[clamp(26px,4vh,46px)]">
					{railCells.map((cell) => (
						<div key={cell.label} className="sable-rail-cell sable-row">
							<dt className={LEDGER_LABEL}>{cell.label}</dt>
							<dd className={`${MONO} mt-[5px] text-[13.5px] text-foreground`}>
								{cell.value}
							</dd>
						</div>
					))}
				</dl>
				<div className="grid gap-[clamp(28px,5vw,90px)] lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
					<div>
						<h2
							id="contact-title"
							className="sable-fade max-w-[12ch] font-display font-medium text-[clamp(2rem,3.8vw,3.2rem)] leading-[1.02] tracking-[-0.035em]"
						>
							{t("brief.title")}
							<AccentDot />
						</h2>
						<p className={`${PROSE} sable-fade mt-[18px] max-w-[40ch]`}>
							{t("brief.intro")}
						</p>
						<p
							className={`${MONO} sable-fade mt-8 max-w-[38ch] text-foreground/55 leading-[1.62]`}
						>
							{t("brief.terms")}
						</p>
					</div>
					<div className="grid gap-x-[clamp(24px,3vw,48px)] gap-y-10 min-[861px]:grid-cols-2">
						<div className="border-foreground border-t">
							<h3 className={`${BLOCK_TITLE} sable-fade`}>
								{t("brief.linesTitle")}
								<AccentDot />
							</h3>
							{/* The same ledger as "what happens next": a list to read, not fields to fill. */}
							<ol>
								{lines.map((line) => (
									<li key={line.number} className={STEP_ROW}>
										<span className="text-foreground/30">{line.number}</span>
										<span>
											<span className="block text-[13.5px]">{line.prompt}</span>
											<span className="text-foreground/80">
												<span aria-hidden="true">— </span>
												{line.hint}
											</span>
										</span>
									</li>
								))}
							</ol>
							<div className="sable-fade mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
								<a
									href={t("brief.sendHref")}
									className="sable-mono inline-flex h-[52px] items-center justify-between gap-3 bg-foreground px-6 text-[12px] text-background uppercase tracking-[0.08em] transition-colors duration-150 hover:bg-primary focus-visible:bg-primary"
								>
									{t("brief.send")}
									<span
										aria-hidden="true"
										className="sable-arrow rtl:-scale-x-100"
									>
										→
									</span>
								</a>
								<a
									href={t("site.phoneHref")}
									className={`${RULED_LINK} ${MONO}`}
								>
									<span className={RULED_LINK_TEXT}>{t("brief.call")}</span>
								</a>
							</div>
							<p
								className={`${MONO} sable-fade mt-4 max-w-[38ch] text-[11.5px] text-foreground/55`}
							>
								{t("brief.sendNote")}
							</p>
						</div>
						<div className="border-foreground border-t">
							<h3 className={`${BLOCK_TITLE} sable-fade`}>
								{t("brief.nextTitle")}
								<AccentDot />
							</h3>
							<ol>
								{nextSteps.map((step) => (
									<li key={step.number} className={STEP_ROW}>
										<span className="text-foreground/30">{step.number}</span>
										<span>
											<span className="block text-[13.5px]">{step.title}</span>
											<span className="text-foreground/55">{step.detail}</span>
										</span>
									</li>
								))}
							</ol>
							{/* The studio details close the column: the email is a link, the address and the hours are facts. */}
							<dl className="border-foreground border-t">
								<div className={CONTACT_ROW}>
									<dt className={LEDGER_LABEL}>{t("brief.contactEmail")}</dt>
									<dd className={MONO}>
										<a href={t("site.emailHref")} className={RULED_LINK}>
											<span className={RULED_LINK_TEXT}>{t("site.email")}</span>
										</a>
									</dd>
								</div>
								<div className={CONTACT_ROW}>
									<dt className={LEDGER_LABEL}>{t("brief.contactWorkshop")}</dt>
									<dd className={MONO}>{t("studio.factWorkshopValue")}</dd>
								</div>
								<div className={CONTACT_ROW}>
									<dt className={LEDGER_LABEL}>{t("brief.contactHours")}</dt>
									<dd className={MONO}>{t("brief.contactHoursValue")}</dd>
								</div>
							</dl>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
