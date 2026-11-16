// The "Last 7 days" panel of the home: the 4 figures as a ruled list in the meter form.
// TodayPage renders it with the translated items of weekKpisQueryOptions.
// Each line has the label, the value, a delta pill when the whole is not the previous window, a bar, and the share.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { QUIET_BADGE_CLASS } from "~/features/gym";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { KpiItem } from "../lib/series";

/** One figure with its label already translated. */
export type WeekFigure = KpiItem & { label: string };

type WeekFiguresCardProps = {
	items: WeekFigure[];
	/** The grid span of the home page. */
	className?: string;
};

// One decimal rounds 0.9996 up to "100%". A value under its whole stops at 99.9 %.
const MAX_SHARE_UNDER_WHOLE = 0.999;
// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;
/** Words after the share, keyed by KpiItem.id. `kpi.ofPrevious` marks a whole of the previous window. */
const WHOLE_WORDS: Record<string, TranslationKey> = {
	"check-ins": "kpi.ofPrevious",
	"spots-booked": "kpi.ofCapacity",
	"active-members": "kpi.ofAll",
	"new-members": "kpi.ofPrevious",
};

/** A ruled list: one line per figure, with a rule between lines. The title names the period once. */
export function WeekFiguresCard({ items, className }: WeekFiguresCardProps) {
	const { t } = useT();
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("today.weekTitle")}</CardTitle>
				<CardDescription>{t("today.weekDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid divide-y">
					{items.map((item) => (
						<FigureLine key={item.id} item={item} />
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

// One line of the list: label and value with the pill, then the meter and the share.
function FigureLine({ item }: { item: WeekFigure }) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const words = WHOLE_WORDS[item.id];
	const isPreviousWhole = words === "kpi.ofPrevious";
	const whole = item.target;

	return (
		<li className="grid gap-2 py-3.5 first:pt-0 last:pb-0">
			<div className="flex items-center justify-between gap-3">
				<span className="label-text text-muted-foreground text-sm">
					{item.label}
				</span>
				<span className="flex items-center gap-2">
					<span className="whitespace-nowrap font-numeric text-xl tabular-nums">
						{number.format(item.value)}
						{whole !== undefined && !isPreviousWhole ? (
							<span className="text-muted-foreground text-sm">{` / ${number.format(whole)}`}</span>
						) : null}
					</span>
					{/* A whole of the previous window gives no pill: the share says it. */}
					{item.change !== null && !isPreviousWhole ? (
						<ChangePill change={item.change} goodWhen={item.goodWhen} />
					) : null}
				</span>
			</div>
			{whole !== undefined ? (
				<>
					<Progress
						value={item.value}
						max={whole}
						aria-label={item.label}
						className="h-1.5"
					/>
					{whole > 0 ? (
						<p className="text-muted-foreground text-xs">
							<bdi dir="ltr" className="tabular-nums">
								{share.format(
									item.value < whole
										? Math.min(item.value / whole, MAX_SHARE_UNDER_WHOLE)
										: item.value / whole,
								)}
							</bdi>
							{words ? ` ${t(words)}` : null}
						</p>
					) : (
						// A previous window of 0 gives no share. The empty track stays, and this line tells why.
						<p className="text-muted-foreground text-xs">
							{t("kpi.noComparison")}
						</p>
					)}
				</>
			) : item.change === null ? (
				<p className="text-muted-foreground text-xs">{t("kpi.noComparison")}</p>
			) : null}
		</li>
	);
}

type ChangePillProps = {
	/** Ratio against the previous window: 0.12 is +12 %. */
	change: number;
	goodWhen: KpiItem["goodWhen"];
};

// The delta pill of one figure. The arrow shows the direction, the color shows good or bad news.
function ChangePill({ change, goodWhen }: ChangePillProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	const isGood = change > 0 === (goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<Badge
			variant={isFlat ? "outline" : isGood ? "success" : "destructive"}
			// A flat change gets a muted fill: no news. The destructive variant is solid red, so it gets the tint of success.
			className={cn(
				isFlat && QUIET_BADGE_CLASS,
				!isFlat &&
					!isGood &&
					"border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12",
			)}
		>
			{isFlat ? null : <TrendIcon className="rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(isFlat ? 0 : change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</Badge>
	);
}
