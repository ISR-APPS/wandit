// Section 04, the numbers: four ruled cells with large figures and cobalt crop marks.
// LandingPage renders it. The figures are fictional sample content; DISTRICTS_COVERED comes from lib/districts.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useReveal } from "../hooks/use-reveal";
import { DISTRICTS_COVERED } from "../lib/districts";
import { formatCount } from "../lib/format";
import { DISPLAY, FIGURES, LABEL, WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";

// Years from the opening in 1998 to the "© 2026" of the footer, homes sold since then, and days from posting to signing.
const YEARS_ON_BOARD = 28;
const HOMES_SOLD = 1340;
const AVERAGE_DAYS = 43;

/** The band has no visible title, as on the printed board: the tag and the note frame the figures. */
export function NumbersSection() {
	const { t, locale } = useT();
	const revealRef = useReveal<HTMLUListElement>();
	const stats = [
		{ value: YEARS_ON_BOARD, label: t("numbers.years") },
		{ value: HOMES_SOLD, label: t("numbers.sold") },
		{ value: AVERAGE_DAYS, label: t("numbers.days") },
		{ value: DISTRICTS_COVERED, label: t("numbers.districts") },
	];

	return (
		<section
			aria-labelledby="numbers-title"
			className={cn(WRAP, "py-[clamp(56px,8vw,110px)]")}
		>
			<SectionHead
				tag={t("numbers.tag")}
				title={t("numbers.title")}
				note={t("numbers.note")}
				titleId="numbers-title"
				isTitleHidden
			/>
			<ul
				ref={revealRef}
				className="rn-stagger grid grid-cols-2 border-foreground/12 border-s border-t md:grid-cols-4"
			>
				{stats.map((stat, index) => (
					<li
						key={stat.label}
						className={cn(
							"rn-cross relative border-foreground/12 border-e border-b px-[clamp(14px,2vw,30px)] py-[clamp(22px,2.6vw,40px)]",
							index === stats.length - 1 && "rn-cross-end",
						)}
					>
						<b
							className={cn(
								DISPLAY,
								FIGURES,
								"block text-[clamp(56px,5.8vw,92px)] leading-[0.9]",
							)}
						>
							{formatCount(stat.value, locale)}
						</b>
						<span className={cn(LABEL, "mt-2 block text-[11px] opacity-75")}>
							{stat.label}
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
