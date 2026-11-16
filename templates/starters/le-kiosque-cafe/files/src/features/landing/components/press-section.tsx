// The showpiece, "On press": tomorrow's front page (No. 143) composes itself while the reader scrolls past it.
// LandingPage renders it between page 2 and the stop-press band. use-edition-press.ts drives --ks-p from 0 to 1;
// kiosque.css maps each block of the sheet to its part of that progress. With no script, or with reduced motion,
// the sheet is printed at rest, with the proof stamp over it.
import { useRef } from "react";
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useEditionPress } from "../hooks/use-edition-press";
import { DATELINE, FURNITURE } from "../lib/type-styles";
import { RoasterPlate } from "./roaster-plate";

const MARGIN_START: readonly TranslationKey[] = [
	"press.marginLeft1",
	"press.marginLeft2",
	"press.marginLeft3",
];
const MARGIN_END: readonly TranslationKey[] = [
	"press.marginRight1",
	"press.marginRight2",
	"press.marginRight3",
];

/** The framed mini front page, with the press notes in the two margins on a wide screen. */
export function PressSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useEditionPress(sectionRef);

	return (
		<section
			ref={sectionRef}
			id="press"
			aria-label={t("press.sectionLabel")}
			className="ks-press py-[clamp(2.6rem,6vh,4.5rem)]"
		>
			<div className="ks-wrap ks-press-stage">
				<p
					className={cn(
						FURNITURE,
						"mb-6 flex items-center justify-center gap-5 text-center font-bold text-[0.74rem] text-foreground/75 tracking-[0.16em] before:h-px before:max-w-44 before:flex-1 before:bg-(--ks-rule-strong) after:h-px after:max-w-44 after:flex-1 after:bg-(--ks-rule-strong)",
					)}
				>
					<span>
						<b className="text-primary">{t("press.label")}</b> —{" "}
						{t("press.labelRest")}
					</span>
				</p>
				<div className="min-[1200px]:grid min-[1200px]:grid-cols-[minmax(0,1fr)_min(920px,100%)_minmax(0,1fr)] min-[1200px]:gap-[clamp(1.2rem,2.5vw,2.2rem)]">
					<PressMargin keys={MARGIN_START} side="start" />
					<div className="ks-mini relative mx-auto w-full max-w-[920px] overflow-hidden border border-(--ks-rule-strong) bg-background p-[clamp(1.1rem,3vw,2.2rem)]">
						<div
							aria-hidden="true"
							className="ks-proof pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
						>
							<span
								className={cn(
									FURNITURE,
									"-rotate-12 whitespace-nowrap border-(--ks-proof-ink) border-3 px-[1.1em] py-[0.5em] font-bold text-(--ks-proof-ink) text-[clamp(1.1rem,2.6vw,1.8rem)] tracking-[0.22em]",
								)}
							>
								{t("press.proof")}
							</span>
						</div>
						<div
							className={cn(
								FURNITURE,
								"flex flex-wrap justify-between gap-x-4 gap-y-1 border-(--ks-rule) border-b pb-2 font-medium text-[0.64rem] text-foreground/80 tracking-[0.08em] min-[640px]:text-[0.68rem]",
							)}
						>
							<span>{t("press.dateline")}</span>
							<span className="whitespace-nowrap">{t("press.edition")}</span>
						</div>
						<p className="ks-p ks-p-mast pt-4 pb-2.5 text-center font-display font-extrabold text-[clamp(1.9rem,4.5vw,3.1rem)] leading-none">
							{t("site.brand")}
						</p>
						<div
							aria-hidden="true"
							className="ks-p ks-p-bar mb-4 h-0.75 bg-foreground"
						/>
						<p className="ks-p ks-p-kicker text-center font-bold font-sans text-[0.72rem] text-primary uppercase tracking-[0.14em]">
							{t("press.kicker")}
						</p>
						<p className="ks-p ks-p-head mt-2 mb-1.5 text-balance text-center font-display font-extrabold text-[clamp(1.7rem,4.2vw,2.9rem)] leading-[1.04]">
							{t("press.headline")}
						</p>
						<p className="ks-p ks-p-deck ks-serif mb-5 text-center text-[0.95rem] text-foreground/80 italic">
							{t("press.deck")}
						</p>
						<div className="grid items-start gap-6 min-[640px]:grid-cols-2 min-[900px]:grid-cols-[1fr_1fr_0.8fr]">
							<MiniColumn
								className="ks-p-col1"
								datelineKey="press.col1Dateline"
								bodyKeys={["press.col1Body1", "press.col1Body2"]}
							/>
							<MiniColumn
								className="ks-p-col2 min-[640px]:border-(--ks-rule) min-[640px]:border-s min-[640px]:ps-6"
								datelineKey="press.col2Dateline"
								bodyKeys={["press.col2Body1", "press.col2Body2"]}
							/>
							<div className="relative mx-auto w-full max-w-[18rem] min-[640px]:col-span-2 min-[900px]:col-span-1 min-[640px]:mx-auto min-[900px]:mx-0 min-[640px]:w-2/3 min-[900px]:w-auto min-[640px]:max-w-none min-[900px]:border-(--ks-rule) min-[900px]:border-s min-[900px]:ps-6">
								<div className="ks-p ks-p-plate">
									<RoasterPlate />
								</div>
								<p className="ks-p ks-p-caption mt-2 border-(--ks-rule) border-t pt-1.5 font-sans text-[0.72rem] text-foreground/75 leading-[1.4]">
									{t("press.caption")}{" "}
									<span className="whitespace-nowrap">
										{t("site.photoCredit")}
									</span>
								</p>
								<span className="ks-p ks-p-stamp absolute end-1.5 -top-3.5 -rotate-8 bg-primary px-[0.8em] py-[0.45em] font-bold font-sans text-[0.7rem] text-primary-foreground uppercase tracking-[0.12em]">
									{t("press.stamp")}
								</span>
							</div>
						</div>
					</div>
					<PressMargin keys={MARGIN_END} side="end" />
				</div>
			</div>
		</section>
	);
}

/** One justified column of the mini front page, opened by its bold caps dateline. */
function MiniColumn({
	className,
	datelineKey,
	bodyKeys,
}: {
	className: string;
	datelineKey: TranslationKey;
	/** The paragraphs of the column, in order. */
	bodyKeys: readonly TranslationKey[];
}) {
	const { t } = useT();
	return (
		<div
			className={cn(
				"ks-p ks-serif hyphens-auto text-justify text-[0.94rem] leading-[1.58]",
				className,
			)}
		>
			{bodyKeys.map((key, index) => (
				<p key={key} className={cn(index > 0 && "mt-2")}>
					{index === 0 && (
						<>
							<span className={DATELINE}>{t(datelineKey)}</span>{" "}
						</>
					)}
					{t(key)}
				</p>
			))}
		</div>
	);
}

/** The press notes of one margin. Only a screen of 1200px or more has room for them; they repeat no content. */
function PressMargin({
	keys,
	side,
}: {
	/** The three notes, top to bottom. */
	keys: readonly TranslationKey[];
	/** The margin of the sheet: the notes align toward the sheet. */
	side: "start" | "end";
}) {
	const { t } = useT();
	return (
		<div
			aria-hidden="true"
			className={cn(
				FURNITURE,
				"hidden flex-col justify-between gap-5 py-1.5 font-bold text-[0.68rem] text-foreground/62 leading-normal tracking-[0.12em] min-[1200px]:flex",
				side === "end" && "text-end",
			)}
		>
			{keys.map((key) => (
				<p key={key} className="border-(--ks-rule) border-t pt-2">
					{side === "start" && (
						<span className="me-2 inline-block size-2.25 bg-primary" />
					)}
					{t(key)}
				</p>
			))}
		</div>
	);
}
