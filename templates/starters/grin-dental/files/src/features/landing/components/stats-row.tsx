// A row of four stat stickers that overlaps the bottom scallop of the teal visit scene.
// LandingPage renders it right after VisitSection. The stats come from STATS in lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { STATS } from "../lib/content";
import { WRAP } from "../lib/styles";
import { StatSticker } from "./stat-sticker";

/** Tilt and number color of each sticker, in row order. */
const STAT_LOOKS = [
	{ tiltClass: "[--gd-r:-2deg]", numberClass: "text-primary" },
	{ tiltClass: "[--gd-r:1.6deg]", numberClass: "text-(--gd-teal)" },
	{ tiltClass: "[--gd-r:-1.2deg]", numberClass: "text-primary" },
	{ tiltClass: "[--gd-r:2deg]", numberClass: "text-(--gd-teal)" },
] as const;

/** The negative top margin pulls the row 86px into the teal band (74px on a phone). A 2 by 2 grid on a phone. */
export function StatsRow() {
	const { t } = useT();
	return (
		<div className={cn(WRAP, "relative z-10")}>
			<ul
				aria-label={t("stats.label")}
				data-pop="kids"
				className="-mt-[5.4rem] flex flex-wrap justify-center gap-[clamp(1rem,2.5vw,2rem)] pb-[clamp(3.5rem,6vw,5.5rem)] max-md:-mt-[4.6rem] max-md:grid max-md:grid-cols-2"
			>
				{STATS.map((stat, index) => (
					<StatSticker
						key={stat.labelKey}
						stat={stat}
						tiltClass={STAT_LOOKS[index]?.tiltClass ?? ""}
						numberClass={STAT_LOOKS[index]?.numberClass ?? ""}
					/>
				))}
			</ul>
		</div>
	);
}
