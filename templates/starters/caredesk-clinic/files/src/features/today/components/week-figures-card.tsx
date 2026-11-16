// The figures of the last 7 days on the home page: a ruled list in the icon form.
// TodayPage renders it with the translated KPI items of weekKpisQueryOptions.
// Each line shows an icon of the counted thing, the label, the value, and the change against the 7 days before.
import {
	ClipboardTextIcon,
	HourglassMediumIcon,
	ProhibitIcon,
	TrendDownIcon,
	TrendUpIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { KpiItem } from "../lib/series";

type WeekFiguresCardProps = {
	/** The figures, the most important first, with translated labels. */
	items: KpiItem[];
	/** The grid span of the home page. */
	className?: string;
};

/** The icon of each figure, by KpiItem.id. A figure with no entry gets no chip. */
const KPI_ICONS: Record<string, KitIcon> = {
	// Not the stethoscope: the nav uses it for the practitioners.
	visits: ClipboardTextIcon,
	"new-patients": UserPlusIcon,
	"no-show-rate": ProhibitIcon,
	wait: HourglassMediumIcon,
};

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

/** The title names the period once. No figure repeats it. */
export function WeekFiguresCard({ items, className }: WeekFiguresCardProps) {
	const { t, locale } = useT();
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("today.figures")}</CardTitle>
				<CardDescription>{t("today.figuresDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid divide-y">
					{items.map((item) => {
						const Icon = KPI_ICONS[item.id];
						return (
							<li
								key={item.id}
								className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
							>
								{Icon ? (
									<span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent text-accent-foreground">
										<Icon className="size-4" />
									</span>
								) : null}
								<span className="label-text min-w-0 flex-1 truncate text-sm">
									{item.label}
								</span>
								<span className="grid justify-items-end gap-0.5">
									<span className="font-numeric font-semibold text-xl tabular-nums leading-none">
										{new Intl.NumberFormat(locale, item.format).format(
											item.value,
										)}
									</span>
									<ChangeLine item={item} />
								</span>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}

// The delta line of one figure. A change of null (no earlier data) never shows "0%".
function ChangeLine({ item }: { item: KpiItem }) {
	const { t, locale } = useT();
	const { change } = item;
	if (change === null) {
		return (
			<span className="text-muted-foreground text-xs">
				{t("kpi.noComparison")}
			</span>
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
		<span
			className={cn(
				"flex items-center gap-1 text-xs",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
			)}
		>
			{isFlat ? null : <TrendIcon className="size-3.5 rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</span>
	);
}
