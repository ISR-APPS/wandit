// Movement 01, "The firm": a doctrine spread. LandingPage renders it after the hero.
// A narrow rail holds the label and the founding year. The body holds the title, two prose columns, and three principles.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PRINCIPLES } from "../lib/content";
import { MICRO, MOVEMENT, SECTION_TITLE, SOFT } from "../lib/type-styles";
import { SectionLabel } from "./section-label";

/** The story of the firm in four short paragraphs, then its three rules as a hairline ledger. */
export function FirmSection() {
	const { t } = useT();
	const paragraphs = [
		t("firm.paragraph1"),
		t("firm.paragraph2"),
		t("firm.paragraph3"),
		t("firm.paragraph4"),
	];
	return (
		<section
			id="firm"
			data-movement
			className={cn(MOVEMENT, "border-foreground/12 border-t")}
		>
			<div className="cap-wrap grid grid-cols-1 items-start gap-[clamp(1.6rem,3vw,3rem)] min-[56.25rem]:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
				{/* From 900px the rail stays under the header while the prose scrolls past it. */}
				<div
					data-reveal
					className="min-[56.25rem]:sticky min-[56.25rem]:top-[calc(var(--cap-bar)+2.5rem)]"
				>
					<SectionLabel className="mb-[1.6rem]">{t("firm.label")}</SectionLabel>
					<p className="border-foreground/18 border-t pt-3.5">
						<span className="block font-display text-[clamp(2rem,3vw,2.6rem)] leading-none tracking-[-0.02em]">
							{t("firm.yearValue")}
						</span>
						<span className={cn(MICRO, SOFT, "mt-2 block")}>
							{t("firm.yearLabel")}
							<br />
							{t("firm.yearPlace")}
						</span>
					</p>
				</div>
				<div>
					<h2
						data-reveal
						className={cn(SECTION_TITLE, "mb-[1.8rem] max-w-[20ch]")}
					>
						{t("firm.title")}
					</h2>
					<div
						data-reveal
						className="gap-x-[clamp(1.8rem,3vw,3rem)] min-[53.75rem]:columns-2"
					>
						{paragraphs.map((paragraph) => (
							<p key={paragraph} className="mb-[1.05em] break-inside-avoid">
								{paragraph}
							</p>
						))}
					</div>
					<div
						data-reveal-group
						className="mt-[clamp(2.4rem,5vh,3.4rem)] grid grid-cols-1 gap-5 border-foreground/12 border-t pt-[1.4rem] min-[47.5rem]:grid-cols-3 min-[47.5rem]:gap-0"
					>
						{PRINCIPLES.map((principle, index) => (
							<div
								key={principle}
								data-reveal
								className={cn(
									"pe-[1.4rem]",
									index > 0 &&
										"min-[47.5rem]:border-foreground/12 min-[47.5rem]:border-s min-[47.5rem]:ps-[clamp(1rem,2vw,1.8rem)]",
								)}
							>
								<h3 className="mb-1.5 font-display font-normal text-[1.15rem] leading-[1.16] tracking-[-0.015em]">
									{t(`firm.${principle}Title`)}
								</h3>
								<p className={cn(SOFT, "max-w-[32ch] text-[0.90625rem]")}>
									{t(`firm.${principle}Body`)}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
