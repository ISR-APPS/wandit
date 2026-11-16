// The KPI figures of the home in the meter form: each value as a share of its whole, with a bar.
// CheckInsPanel renders them at the top of its content. This file turns each `labelKey` into a label with t().
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";

// One decimal rounds 0.9996 up to "100%". A value under its whole stops at 99.9 %.
const MAX_SHARE_UNDER_WHOLE = 0.999;
// A change under 0.05 % shows "0%" with no arrow: one decimal rounds it to zero.
const FLAT_CHANGE = 0.0005;

/** Words after the share and the screen reader text of the delta, keyed by KpiItem.id. */
const KPI_WORDS: Record<
	string,
	{ whole: TranslationKey; comparison: TranslationKey; empty: TranslationKey }
> = {
	"rooms-sold": {
		whole: "kpi.ofAllRooms",
		comparison: "kpi.vsLastNight",
		empty: "kpi.noRooms",
	},
	"check-ins-done": {
		whole: "kpi.ofArrivals",
		comparison: "kpi.vsLastNight",
		empty: "kpi.noArrivals",
	},
};

type KpiMetersProps = {
	/** The figures to show, in order. `target` is the whole of each value. */
	items: KpiItem[];
	/** The grid class of the slot, for example the column count. */
	className?: string;
};

/** One figure per item: the label, "value / whole", the delta pill, the meter, and the share line. */
export function KpiMeters({ items, className }: KpiMetersProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const delta = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
		signDisplay: "exceptZero",
	});

	return (
		<div className={cn("grid gap-6", className)}>
			{items.map((item) => {
				const label = t(item.labelKey);
				const words = KPI_WORDS[item.id];
				const ratio = item.target > 0 ? item.value / item.target : 0;
				const isFlat =
					item.change !== null && Math.abs(item.change) < FLAT_CHANGE;
				const isGood =
					item.change !== null &&
					(item.goodWhen === "up" ? item.change > 0 : item.change < 0);
				return (
					<div key={item.id} className="grid content-start gap-2">
						<p className="label-text text-muted-foreground text-sm">{label}</p>
						<div className="flex items-end justify-between gap-3">
							<p className="font-numeric text-3xl tabular-nums leading-none">
								{number.format(item.value)}
								<span className="text-lg text-muted-foreground">
									{` / ${number.format(item.target)}`}
								</span>
							</p>
							{item.change !== null ? (
								<Badge
									variant={
										isFlat ? "secondary" : isGood ? "success" : "outline"
									}
									className={cn(
										!isFlat &&
											!isGood &&
											"border-destructive/25 bg-destructive/10 text-destructive",
									)}
								>
									{/* A trend arrow mirrors in Arabic. A rotation would turn a rise into a fall. */}
									{isFlat ? null : item.change > 0 ? (
										<TrendUpIcon className="rtl:-scale-x-100" />
									) : (
										<TrendDownIcon className="rtl:-scale-x-100" />
									)}
									<bdi dir="ltr" className="tabular-nums">
										{delta.format(isFlat ? 0 : item.change)}
									</bdi>
									<span className="sr-only">
										{words ? t(words.comparison) : null}
									</span>
								</Badge>
							) : null}
						</div>
						<Progress value={item.value} max={item.target} aria-label={label} />
						{/* A whole of 0 draws the empty track and no share. One muted line tells why. */}
						<p className="text-muted-foreground text-sm">
							{item.target > 0 ? (
								<>
									<bdi dir="ltr" className="tabular-nums">
										{share.format(
											item.value < item.target
												? Math.min(ratio, MAX_SHARE_UNDER_WHOLE)
												: ratio,
										)}
									</bdi>
									{words ? ` ${t(words.whole)}` : null}
								</>
							) : words ? (
								t(words.empty)
							) : null}
						</p>
					</div>
				);
			})}
		</div>
	);
}

type KpiMetersSkeletonProps = {
	/** How many figures the slot shows. */
	count: number;
	/** The same grid class as KpiMeters. */
	className?: string;
};

/** Placeholder of the figures: the label, the value, the meter, and the share line in their final sizes. */
export function KpiMetersSkeleton({
	count,
	className,
}: KpiMetersSkeletonProps) {
	return (
		<div className={cn("grid gap-6", className)}>
			{Array.from({ length: count }, (_, index) => `kpi-${index}`).map(
				(key) => (
					<div key={key} className="grid gap-2">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-8 w-24" />
						<Skeleton className="h-2 w-full" />
						<Skeleton className="h-5 w-28" />
					</div>
				),
			)}
		</div>
	);
}
