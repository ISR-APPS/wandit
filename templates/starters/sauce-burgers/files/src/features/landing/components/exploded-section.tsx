// The showpiece on the hot ground: the Double comes apart, layer by layer, while the visitor scrolls.
// LandingPage renders it after the menu. From 901px the whole field sticks under the header; on a phone only the stack sticks.
// hooks/use-sticky-progress.ts gives the scroll progress, and landing.css moves the slices.
import { ArrowDownIcon } from "@phosphor-icons/react";
import { useRef } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useStickyProgress } from "../hooks/use-sticky-progress";
import { DOUBLE_BURGER } from "../lib/content";
import {
	BUTTON,
	BUTTON_MUSTARD,
	DISPLAY_TEXT,
	LABEL_TEXT,
	TITLE_LEADING,
	WRAP,
} from "../lib/type-styles";
import { DripEdge } from "./drip-edge";
import { ExplodedStack } from "./exploded-stack";
import { Price } from "./price";
import { SectionEyebrow } from "./section-eyebrow";

// Three facts of the Double. Each value is a short display figure over one line of text.
const FACTS: readonly { valueKey: TranslationKey; labelKey: TranslationKey }[] =
	[
		{ valueKey: "exploded.factBeefValue", labelKey: "exploded.factBeefLabel" },
		{
			valueKey: "exploded.factLayersValue",
			labelKey: "exploded.factLayersLabel",
		},
		{ valueKey: "exploded.factTimeValue", labelKey: "exploded.factTimeLabel" },
	];

/**
 * With reduced motion the section has a normal height.
 * With no script the track keeps its height and the stack shows open (--sc-progress stays 1).
 */
export function ExplodedSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useStickyProgress(sectionRef);
	return (
		<section
			ref={sectionRef}
			id="exploded"
			className="sc-explode sc-on-hot relative scroll-mt-15 bg-primary text-primary-foreground"
		>
			<DripEdge variant="b" tone="cream" />
			{/* A track and its first child make one sticky pair. The hook reads the pair that sticks at this width. */}
			<div data-scrub-track="" className="sc-track">
				<div className="sc-pin">
					<div className={cn(WRAP, "sc-explode-grid")}>
						<div className="sc-explode-head">
							<SectionEyebrow label={t("exploded.eyebrow")} ground="hot" />
							<h2
								className={cn(
									DISPLAY_TEXT,
									"text-[clamp(2.2rem,4vw,3.5rem)]",
									TITLE_LEADING,
								)}
							>
								{t("exploded.titleLine1")}
								<br />
								{t("exploded.titleLine2")}
							</h2>
							<p className="mt-3.5 max-w-[34ch] text-[clamp(1.02rem,1.35vw,1.28rem)]">
								{t("exploded.lede")}
							</p>
							<p
								className={cn(
									LABEL_TEXT,
									"mt-4 flex items-center gap-1.5 motion-reduce:hidden",
								)}
							>
								<ArrowDownIcon className="size-3.5" />
								{t("exploded.hint")}
							</p>
						</div>
						<div data-scrub-track="" className="sc-stage-track">
							<div className="sc-stage">
								<ExplodedStack />
							</div>
						</div>
						<div className="sc-explode-facts">
							<dl className="grid grid-cols-3 gap-x-4 border-primary-foreground/40 border-y-2 py-3.5">
								{FACTS.map((fact) => (
									<div key={fact.valueKey}>
										<dt
											className={cn(
												DISPLAY_TEXT,
												"text-(--sc-mustard-on-hot) text-[clamp(1.5rem,2.4vw,2.1rem)] leading-none",
											)}
										>
											{t(fact.valueKey)}
										</dt>
										<dd className="mt-1.5 text-[0.84rem] leading-[1.3]">
											{t(fact.labelKey)}
										</dd>
									</div>
								))}
							</dl>
							<div className="mt-[clamp(16px,2.4vh,24px)] flex flex-wrap items-center gap-x-5 gap-y-3">
								<a href="#order" className={cn(BUTTON, BUTTON_MUSTARD)}>
									{t("exploded.orderDouble")}
								</a>
								<Price amountDa={DOUBLE_BURGER.priceDa} unitTone="inherit" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
