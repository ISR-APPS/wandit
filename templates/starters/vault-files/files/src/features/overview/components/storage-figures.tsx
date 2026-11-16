// The band of the home: four figures, each with its value, its whole, a meter, and the share of the whole.
// OverviewPage renders it with the translated KPI items. It follows the meter form of the app-dashboard skill.
import { formatBytes } from "~/features/workspace";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";

// One decimal rounds 0.9996 up to "100%". A value under its whole stops at 99.9 %.
const MAX_SHARE_UNDER_WHOLE = 0.999;

/** Words after the share, per figure. kpi.ofPrevious marks a whole of the previous period: no " / whole" then. */
const WHOLE_WORDS = {
	"storage-used": "kpi.ofPlan",
	"uploads-week": "kpi.ofPrevious",
	"shared-files": "kpi.ofAllFiles",
	seats: "kpi.ofSeats",
} as const satisfies Record<KpiItem["id"], TranslationKey>;

type StorageFiguresProps = {
	items: KpiItem[];
	/** The grid class of the home slot. */
	className?: string;
};

/** One Card per figure. The values use the numeral face of the theme. */
export function StorageFigures({ items, className }: StorageFiguresProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const format = (item: KpiItem, value: number) =>
		item.unit === "bytes" ? formatBytes(value, locale) : number.format(value);

	return (
		<div className={className}>
			{items.map((item) => {
				const words = WHOLE_WORDS[item.id];
				const isPrevious = words === "kpi.ofPrevious";
				const ratio = item.whole > 0 ? item.value / item.whole : 0;
				return (
					<Card key={item.id} className="gap-3 px-5 py-5">
						<p className="label-text text-muted-foreground text-sm">
							{item.label}
						</p>
						<p className="flex flex-wrap items-baseline gap-x-1.5">
							<span className="font-numeric font-semibold text-3xl tabular-nums">
								{format(item, item.value)}
							</span>
							{isPrevious ? null : (
								<span className="text-muted-foreground text-sm tabular-nums">
									{`/ ${format(item, item.whole)}`}
								</span>
							)}
						</p>
						<Progress
							value={item.value}
							max={item.whole}
							aria-label={item.label}
							// The meters carry the primary hue, so the band reads as Vault, not as grey ink.
							className="h-1.5 [&>[data-slot=progress-indicator]]:bg-primary"
						/>
						{item.whole > 0 ? (
							<p className="text-muted-foreground text-sm">
								<bdi
									dir="ltr"
									className="font-medium text-foreground tabular-nums"
								>
									{share.format(
										item.value < item.whole
											? Math.min(ratio, MAX_SHARE_UNDER_WHOLE)
											: ratio,
									)}
								</bdi>{" "}
								{t(words)}
							</p>
						) : (
							// A previous period of 0 gives no share. The empty track stays, and this line tells why.
							<p className="text-muted-foreground text-sm">
								{t("kpi.noComparison")}
							</p>
						)}
					</Card>
				);
			})}
		</div>
	);
}

// Placeholder figures. Fixed keys, because the figures never reorder.
const SKELETON_FIGURES = ["1", "2", "3", "4"];

/** Placeholder of the band, in the final sizes of the label, the value, the meter, and the share line. */
export function StorageFiguresSkeleton({ className }: { className?: string }) {
	return (
		<div className={className}>
			{SKELETON_FIGURES.map((key) => (
				<Card key={key} className={cn("gap-3 px-5 py-5")}>
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-9 w-36" />
					<Skeleton className="h-1.5 w-full" />
					<Skeleton className="h-4 w-32" />
				</Card>
			))}
		</div>
	);
}
