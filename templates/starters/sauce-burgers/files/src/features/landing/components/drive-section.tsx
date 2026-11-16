// The drive: the order path as three numbered steps with fat arrows, and an ink plate with the telephone.
// LandingPage renders it after the sauces. The quote band closes the section on the hot ground.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	DISPLAY_TEXT,
	LABEL_TEXT,
	SLIDE_ON_HOVER,
	TITLE_LEADING,
	WRAP,
} from "../lib/type-styles";
import { DripEdge } from "./drip-edge";
import { QuoteBand } from "./quote-band";
import { SectionEyebrow } from "./section-eyebrow";
import { StepArrow } from "./step-arrow";

// The middle step is the choice that the customer makes: the sauce.
const STEPS: readonly { titleKey: TranslationKey; bodyKey: TranslationKey }[] =
	[
		{ titleKey: "drive.stepOrderTitle", bodyKey: "drive.stepOrderBody" },
		{ titleKey: "drive.stepSauceTitle", bodyKey: "drive.stepSauceBody" },
		{ titleKey: "drive.stepPickupTitle", bodyKey: "drive.stepPickupBody" },
	];

/** The steps are one row from 768px. On a phone they stack, and each arrow points down. */
export function DriveSection() {
	const { t } = useT();
	return (
		<section id="drive" className="relative scroll-mt-15 pt-(--sc-pad)">
			<DripEdge variant="a" tone="mustard" />
			<div className={WRAP}>
				<div
					data-flick="l"
					className="mb-[clamp(28px,4.4vh,52px)] flex flex-wrap items-end justify-between gap-[clamp(18px,3vw,40px)]"
				>
					<div className="max-w-[52ch]">
						<SectionEyebrow label={t("drive.eyebrow")} ground="cream" />
						<h2
							className={cn(
								DISPLAY_TEXT,
								"text-[clamp(2.3rem,5.6vw,4.2rem)]",
								TITLE_LEADING,
							)}
						>
							{t("drive.titleLine1")}
							<br />
							{t("drive.titleLine2")}
						</h2>
						<p className="mt-3.5">{t("drive.intro")}</p>
					</div>
					<a
						href={t("site.phoneHref")}
						className={cn(
							SLIDE_ON_HOVER,
							"sc-on-hot group w-full bg-foreground px-5 py-[15px] text-background hover:bg-primary focus-visible:bg-primary sm:w-auto",
						)}
					>
						{/* The card turns red on hover. Small mustard text fails the contrast there, so it turns white. */}
						<span
							className={cn(
								LABEL_TEXT,
								"mb-1.75 block text-(--sc-mustard) group-hover:text-primary-foreground group-focus-visible:text-primary-foreground",
							)}
						>
							{t("drive.callLabel")}
						</span>
						<b
							className={cn(
								DISPLAY_TEXT,
								"block whitespace-nowrap text-[clamp(1.9rem,3.4vw,2.9rem)] leading-none tracking-[0.01em]",
							)}
						>
							{t("site.phoneDisplay")}
						</b>
					</a>
				</div>
				{/* From 768px a later step spans two columns of the row: its arrow column, then its text column. */}
				<ol
					data-flick="l"
					className="grid items-start gap-[clamp(12px,1.8vw,30px)] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
				>
					{STEPS.map((step, index) => (
						<li
							key={step.titleKey}
							className={cn(
								index > 0 &&
									"grid gap-[clamp(12px,1.8vw,30px)] md:col-span-2 md:grid-cols-subgrid",
							)}
						>
							{index > 0 ? <StepArrow /> : null}
							<div>
								<span className="block font-display text-[clamp(3.4rem,7vw,6rem)] text-primary leading-[0.78]">
									{index + 1}
								</span>
								<h3
									className={cn(
										DISPLAY_TEXT,
										"mt-2.5 mb-2.25 border-foreground border-b-[3px] pb-2.25 text-[clamp(1.2rem,2vw,1.7rem)] leading-none",
									)}
								>
									{t(step.titleKey)}
								</h3>
								<p className="text-[0.95rem]">{t(step.bodyKey)}</p>
							</div>
						</li>
					))}
				</ol>
			</div>
			<QuoteBand />
		</section>
	);
}
