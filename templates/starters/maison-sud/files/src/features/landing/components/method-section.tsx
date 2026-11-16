// The method section: a two-line title, then four numbered stages on hairlines beside a tall portrait photo.
// LandingPage renders it. The photo stays in view while the visitor reads the stages.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	GRID,
	NUMERAL,
	RULE_LABEL,
	SECTION_TITLE,
	SERIF_NAME,
	WRAP,
} from "../lib/type-styles";
import { Aperture } from "./aperture";
import { PlanGlyph, type PlanGlyphName } from "./plan-glyph";

// The four stages of a project, in the order of the work.
const STEPS: readonly {
	digits: string;
	glyph: PlanGlyphName;
	nameKey: TranslationKey;
	bodyKey: TranslationKey;
}[] = [
	{
		digits: "01",
		glyph: "plan",
		nameKey: "method.step1Name",
		bodyKey: "method.step1Body",
	},
	{
		digits: "02",
		glyph: "room",
		nameKey: "method.step2Name",
		bodyKey: "method.step2Body",
	},
	{
		digits: "03",
		glyph: "stone",
		nameKey: "method.step3Name",
		bodyKey: "method.step3Body",
	},
	{
		digits: "04",
		glyph: "stair",
		nameKey: "method.step4Name",
		bodyKey: "method.step4Body",
	},
];

/** Section "Method". The photo has a caption on a hairline under it, so it takes no plinth. */
export function MethodSection() {
	const { t } = useT();
	return (
		<section
			id="method"
			className="scroll-mt-28 py-(--ms-rhythm) md:scroll-mt-19"
		>
			<div className={cn(WRAP, GRID, "gap-y-10")}>
				<div className="md:col-span-8">
					<p data-reveal="lift" className={RULE_LABEL}>
						{t("method.label")}
					</p>
					<h2 data-reveal="lift" className={cn(SECTION_TITLE, "mt-[1.1rem]")}>
						<span className="block">{t("method.title1")}</span>
						<span className="block">{t("method.title2")}</span>
					</h2>
				</div>
				{/* From 768px the photo sticks under the header, 5.5rem from the top, while the stages scroll. */}
				<Aperture
					src="/images/bathroom.webp"
					alt={t("method.imageAlt")}
					width={1600}
					height={900}
					shape="portrait"
					focusClassName="object-[30%_center]"
					className="md:sticky md:top-22 md:col-span-4 md:row-start-2 lg:col-span-5"
				>
					<figcaption className="mt-3.5 border-foreground/10 border-t pt-[0.8rem] text-[0.86rem] text-muted-foreground leading-[1.55]">
						{t("method.imageCaption")}
					</figcaption>
				</Aperture>
				<ol className="md:col-span-8 md:col-start-5 md:row-start-2 lg:col-span-6 lg:col-start-7">
					{STEPS.map((step) => (
						<li
							key={step.digits}
							data-reveal="lift"
							className="grid grid-cols-[clamp(3.4rem,6vw,5rem)_1fr] gap-x-[clamp(0.6rem,1.4vw,1.2rem)] border-foreground/10 border-t py-[clamp(1.4rem,2.4vw,1.9rem)] last:border-b"
						>
							{/* One column width for the four numerals, so the names start on one line. */}
							<span
								aria-hidden="true"
								className={cn(
									NUMERAL,
									"text-[clamp(2.2rem,4vw,3.2rem)] leading-none",
								)}
							>
								{step.digits}
							</span>
							<div className="min-w-0">
								<div className="mb-1.5 flex items-center justify-between gap-4">
									<h3 className={SERIF_NAME}>{t(step.nameKey)}</h3>
									<PlanGlyph name={step.glyph} />
								</div>
								<p className="max-w-[52ch] text-[0.98rem] text-foreground/70 leading-[1.72]">
									{t(step.bodyKey)}
								</p>
							</div>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
