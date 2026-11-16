// The figures of a page in the "icon" form: the label, an icon chip, the value, and the change line.
// The employees, time-off, and hiring pages render a row of them under their header.
// The page passes translated KpiItem rows and the grid class of its row.
import {
	AirplaneTakeoffIcon,
	BriefcaseIcon,
	CalendarCheckIcon,
	ChatsCircleIcon,
	DoorOpenIcon,
	HourglassMediumIcon,
	SealCheckIcon,
	ThermometerIcon,
	TrayArrowDownIcon,
	TrendDownIcon,
	TrendUpIcon,
	UserPlusIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";

/** The icon of each KPI id, named after the counted thing. A KPI with no entry gets no chip. */
const KPI_ICONS: Record<string, KitIcon> = {
	headcount: UsersThreeIcon,
	joiners: UserPlusIcon,
	probation: SealCheckIcon,
	leavers: DoorOpenIcon,
	"out-today": AirplaneTakeoffIcon,
	"to-review": HourglassMediumIcon,
	"booked-days": CalendarCheckIcon,
	"sick-days": ThermometerIcon,
	"open-positions": BriefcaseIcon,
	"in-process": UsersThreeIcon,
	interviews: ChatsCircleIcon,
	applications: TrayArrowDownIcon,
};

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

// The delta line of one figure. A change of null (no earlier data) shows the scope note of the figure, never "0%".
function ChangeLine({ item }: { item: KpiItem }) {
	const { t, locale } = useT();
	const { change } = item;
	if (change === null) {
		return (
			<p className="text-muted-foreground text-sm">
				{item.note ?? t("kpi.noComparison")}
			</p>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (item.goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<p
			className={cn(
				"flex items-center gap-1 text-sm",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
			)}
		>
			{isFlat ? null : <TrendIcon className="size-4 rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</p>
	);
}

type KpiFiguresProps = {
	/** The figures, labels already translated, in the order of importance. */
	items: KpiItem[];
	/** The grid of the row, for example "grid-cols-2 @4xl/main:grid-cols-4". */
	className?: string;
};

/** A row of figure cards. Each card names its own unit in its label; the page names the period once. */
export function KpiFigures({ items, className }: KpiFiguresProps) {
	const { locale } = useT();
	return (
		<div className={cn("grid gap-4", className)}>
			{items.map((item) => {
				const Icon = KPI_ICONS[item.id];
				return (
					<Card key={item.id} className="gap-3 py-5">
						<CardContent className="grid gap-2 px-5">
							{/* min-h-11 holds a two-line label, so the values of one row stay on one line. */}
							<div className="flex min-h-11 items-start justify-between gap-3">
								<p className="label-text pt-1 text-muted-foreground text-sm">
									{item.label}
								</p>
								{Icon ? (
									<span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent text-accent-foreground">
										<Icon className="size-4" />
									</span>
								) : null}
							</div>
							<p className="font-numeric text-3xl tabular-nums leading-none">
								{new Intl.NumberFormat(locale, item.format).format(item.value)}
							</p>
							<ChangeLine item={item} />
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

// Fixed keys: the skeleton cards never reorder.
const SKELETON_KEYS = ["1", "2", "3", "4"];

type KpiFiguresSkeletonProps = {
	/** How many cards to draw, as many as the loaded row has. */
	count: number;
	/** The same grid class as the loaded row. */
	className?: string;
};

/** Placeholder of a figure row, with the label, the chip, the value, and the delta in their final sizes. */
export function KpiFiguresSkeleton({
	count,
	className,
}: KpiFiguresSkeletonProps) {
	return (
		<div className={cn("grid gap-4", className)}>
			{SKELETON_KEYS.slice(0, count).map((key) => (
				<Card key={key} className="gap-3 py-5">
					<CardContent className="grid gap-2 px-5">
						<div className="flex min-h-11 items-start justify-between gap-3">
							<Skeleton className="mt-1 h-4 w-24" />
							<Skeleton className="size-9" />
						</div>
						<Skeleton className="h-8 w-16" />
						<Skeleton className="h-4 w-20" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}
