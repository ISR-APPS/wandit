// The numbers band: four plain figures on a sky pool.
// LandingPage renders it under the hero. The figures do not count up: they stand as they are.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/class-names";
import { LabelPill } from "./label-pill";

// One figure, its optional unit in blue, one line of caption, and its reveal delay.
// Each figure starts 60 ms after the figure before it.
// A unit message holds its own leading space when the language needs one: " days", but "%".
const STATS = [
	{
		valueKey: "stats.shopsValue",
		unitKey: null,
		captionKey: "stats.shopsCaption",
		delayClassName: "",
	},
	{
		valueKey: "stats.invoicesValue",
		unitKey: null,
		captionKey: "stats.invoicesCaption",
		delayClassName: "[--fw-delay:60ms]",
	},
	{
		valueKey: "stats.daysValue",
		unitKey: "stats.daysUnit",
		captionKey: "stats.daysCaption",
		delayClassName: "[--fw-delay:120ms]",
	},
	{
		valueKey: "stats.uptimeValue",
		unitKey: "stats.uptimeUnit",
		captionKey: "stats.uptimeCaption",
		delayClassName: "[--fw-delay:180ms]",
	},
] as const;

/** The pool is inset from the screen edge, so it reads as a pool and not as a stripe. */
export function StatsSection() {
	const { t } = useT();
	return (
		<section
			aria-label={t("stats.sectionLabel")}
			className="mx-[clamp(12px,2vw,28px)] rounded-[calc(var(--radius)*1.75)] bg-(--fw-sky-soft)"
		>
			<div className={`${WRAP} py-[clamp(2.6rem,5vw,3.8rem)]`}>
				<LabelPill>{t("stats.label")}</LabelPill>
				<ul className="mt-7 grid grid-cols-2 gap-x-[clamp(1.25rem,3vw,2.5rem)] gap-y-8 lg:grid-cols-4">
					{STATS.map((stat) => (
						<li key={stat.valueKey} data-reveal className={stat.delayClassName}>
							<p className="font-display font-extrabold text-[clamp(2rem,3.6vw,3rem)] tabular-nums leading-[1.1] tracking-[-0.02em]">
								{t(stat.valueKey)}
								{stat.unitKey === null ? null : (
									<span className="font-bold text-[0.55em] text-primary">
										{t(stat.unitKey)}
									</span>
								)}
							</p>
							<p className="mt-1.5 max-w-[16em] text-[0.9rem] text-muted-foreground leading-normal">
								{t(stat.captionKey)}
							</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
