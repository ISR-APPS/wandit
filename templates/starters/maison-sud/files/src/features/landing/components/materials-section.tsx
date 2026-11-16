// The materials section: the six materials of the studio as a typographic grid.
// No swatch and no photo: a glyph, a number, a serif name, one factual line, and the origin.
// LandingPage renders it. It reads the texts of the "materials" message group.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	GRID,
	MICRO_CAPS_TIGHT,
	RULE_LABEL,
	SECTION_TITLE,
	WRAP,
} from "../lib/type-styles";
import { PlanGlyph, type PlanGlyphName } from "./plan-glyph";

// The short list. The page numbers its materials as it numbers its rooms.
const MATERIALS: readonly {
	/** Two digits of the material number. The page prints them after the "N°" prefix. Not translated. */
	digits: string;
	glyph: PlanGlyphName;
	nameKey: TranslationKey;
	bodyKey: TranslationKey;
	originKey: TranslationKey;
}[] = [
	{
		digits: "01",
		glyph: "room",
		nameKey: "materials.limeName",
		bodyKey: "materials.limeBody",
		originKey: "materials.limeOrigin",
	},
	{
		digits: "02",
		glyph: "wood",
		nameKey: "materials.oakName",
		bodyKey: "materials.oakBody",
		originKey: "materials.oakOrigin",
	},
	{
		digits: "03",
		glyph: "stone",
		nameKey: "materials.marbleName",
		bodyKey: "materials.marbleBody",
		originKey: "materials.marbleOrigin",
	},
	{
		digits: "04",
		glyph: "bath",
		nameKey: "materials.concreteName",
		bodyKey: "materials.concreteBody",
		originKey: "materials.concreteOrigin",
	},
	{
		digits: "05",
		glyph: "linen",
		nameKey: "materials.linenName",
		bodyKey: "materials.linenBody",
		originKey: "materials.linenOrigin",
	},
	{
		digits: "06",
		glyph: "brass",
		nameKey: "materials.brassName",
		bodyKey: "materials.brassBody",
		originKey: "materials.brassOrigin",
	},
];

/** Section "Materials". Three columns from 1024px, two from 768px, one on a phone. */
export function MaterialsSection() {
	const { t } = useT();
	return (
		<section
			id="materials"
			className="scroll-mt-28 py-(--ms-rhythm) md:scroll-mt-19"
		>
			<div className={WRAP}>
				<div className={cn(GRID, "mb-[clamp(2.4rem,4.4vw,3.6rem)] gap-y-0")}>
					<div className="md:col-span-8">
						<p data-reveal="lift" className={RULE_LABEL}>
							{t("materials.label")}
						</p>
						<h2 data-reveal="lift" className={cn(SECTION_TITLE, "mt-[1.1rem]")}>
							{t("materials.title")}
						</h2>
					</div>
					<p
						data-reveal="lift"
						className="mt-[1.4rem] text-[0.98rem] text-foreground/70 leading-[1.72] md:col-span-6"
					>
						{t("materials.note")}
					</p>
				</div>
				<ul
					data-reveal="stagger"
					className="grid gap-x-(--ms-gap) gap-y-[clamp(1.6rem,3vw,2.6rem)] md:grid-cols-2 lg:grid-cols-3"
				>
					{MATERIALS.map((material) => (
						<li
							key={material.digits}
							className="flex flex-col border-foreground/10 border-t pt-[1.1rem]"
						>
							<div className="mb-2 flex items-center gap-2.5">
								<PlanGlyph name={material.glyph} />
								<span className={MICRO_CAPS_TIGHT}>
									{`${t("site.numberPrefix")}${material.digits}`}
								</span>
								<h3 className="ms-0.5 ms-serif text-[1.3rem] leading-tight">
									{t(material.nameKey)}
								</h3>
							</div>
							<p className="mb-2.5 text-[0.94rem] text-foreground/70 leading-[1.7]">
								{t(material.bodyKey)}
							</p>
							{/* The origin sits on the bottom of the cell, so the origins of one row are on one line. */}
							<span className={cn(MICRO_CAPS_TIGHT, "mt-auto")}>
								{t(material.originKey)}
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
