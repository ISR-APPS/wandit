// The before and with comparison: a bare muted list beside one floating card.
// LandingPage renders it. The difference between the two columns is the point of the section.
import { useT } from "~/shared/i18n";
import { SECTION_SPACE, WRAP } from "../lib/class-names";
import { CheckList } from "./check-list";
import { SectionHead } from "./section-head";

// The reveal delay of each row: 60 ms after the row before it.
const BEFORE_ROWS = [
	{ textKey: "compare.before1", delayClassName: "" },
	{ textKey: "compare.before2", delayClassName: "[--fw-delay:60ms]" },
	{ textKey: "compare.before3", delayClassName: "[--fw-delay:120ms]" },
	{ textKey: "compare.before4", delayClassName: "[--fw-delay:180ms]" },
] as const;

const AFTER_KEYS = [
	"compare.after1",
	"compare.after2",
	"compare.after3",
	"compare.after4",
] as const;

/** The "before" rows have a drawn cross at 40% ink. The "with" rows have the blue check. */
export function CompareSection() {
	const { t } = useT();
	return (
		<section aria-label={t("compare.sectionLabel")} className={SECTION_SPACE}>
			<div className={WRAP}>
				<SectionHead label={t("compare.label")} title={t("compare.title")} />
				<div className="mt-10 grid items-center gap-[clamp(2rem,4vw,3.5rem)] md:grid-cols-[1fr_1.1fr]">
					<div className="md:ps-2">
						<h3 className="font-bold font-display text-[1.05rem] text-muted-foreground tracking-[0.02em]">
							{t("compare.beforeTitle")}
						</h3>
						<ul className="mt-5 grid gap-4 text-[1.0625rem] text-muted-foreground">
							{BEFORE_ROWS.map((row) => (
								<li
									key={row.textKey}
									data-reveal
									className={`flex items-start gap-3 ${row.delayClassName}`}
								>
									<svg
										width="18"
										height="18"
										viewBox="0 0 18 18"
										aria-hidden="true"
										className="mt-[0.3em] shrink-0"
									>
										<path
											d="M4.5 4.5l9 9M13.5 4.5l-9 9"
											strokeWidth="2"
											strokeLinecap="round"
											className="stroke-foreground/40"
										/>
									</svg>
									<span className="text-pretty">{t(row.textKey)}</span>
								</li>
							))}
						</ul>
					</div>
					<div data-reveal>
						<div className="fw-card fw-card-lift p-[clamp(1.6rem,3vw,2.4rem)]">
							<h3 className="font-bold font-display text-(--fw-blue-deep) text-[1.05rem] tracking-[0.02em]">
								{t("compare.afterTitle")}
							</h3>
							<CheckList
								items={AFTER_KEYS.map((key) => t(key))}
								tone="ink"
								className="mt-5 gap-4 text-[1.0625rem]"
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
