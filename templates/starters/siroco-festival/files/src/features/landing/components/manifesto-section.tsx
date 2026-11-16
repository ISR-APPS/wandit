// The manifesto, the claim sheet. A giant "!" carries the claim; the copy and four numbers stand beside it.
// LandingPage renders it on vermilion, right after the hero.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LABEL, SHEET_PAD, SUB_DISPLAY, WRAP } from "../lib/type-styles";

/** The four honest numbers of the festival. */
const FACTS = [
	{ value: "24", labelKey: "manifesto.bands" },
	{ value: "2", labelKey: "manifesto.stages" },
	{ value: "12", labelKey: "manifesto.foodTrucks" },
	{ value: "1", labelKey: "manifesto.sea" },
] as const;

/** The "!" takes the start column from 1024px. On a phone it stands above the claim, in its own row. */
export function ManifestoSection() {
	const { t } = useT();
	return (
		<section
			id="manifesto"
			aria-labelledby="manifesto-title"
			className="sf-vermilion relative overflow-clip"
		>
			<div
				className={cn(
					WRAP,
					SHEET_PAD,
					"grid items-center gap-x-[clamp(2rem,5vw,5rem)] gap-y-4 lg:min-h-[88vh] lg:grid-cols-[minmax(180px,0.62fr)_1.38fr]",
				)}
			>
				<p
					aria-hidden="true"
					data-slab=""
					data-watch="parent"
					data-from="start"
					className="sf-glyph -ms-[0.06em] font-display text-[clamp(11rem,34vh,16rem)] lg:text-[clamp(18rem,62vh,36rem)] lg:leading-[0.8]"
				>
					!
				</p>
				<div data-slab="">
					<p className={LABEL}>{t("manifesto.label")}</p>
					<h2 id="manifesto-title" className={cn(SUB_DISPLAY, "mt-5 mb-6")}>
						{t("manifesto.title")}
					</h2>
					<p className="mb-10 max-w-[36em] text-[clamp(1.02rem,1.3vw,1.2rem)]">
						{t("manifesto.body")}
					</p>
					<ul
						aria-label={t("manifesto.factsLabel")}
						className="grid grid-cols-2 gap-x-8 gap-y-6 border-current border-t-2 pt-6 sm:flex sm:flex-wrap sm:gap-x-13"
					>
						{FACTS.map((fact) => (
							<li key={fact.labelKey}>
								<span className="block font-display text-[clamp(2.6rem,4.5vw,4rem)] leading-none">
									{fact.value}
								</span>
								<span className="mt-1.5 block font-semibold text-[0.8rem] uppercase tracking-[0.07em]">
									{t(fact.labelKey)}
								</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
