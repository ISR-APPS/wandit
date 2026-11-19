// The devices card of the home: the active users of the period, a trend arrow, and their split
// between computers (web and desktop app) and phones (iOS and Android) as two chips and one stacked bar.
// OverviewPage renders it last in the first row of three small cards.
import { changeRatio, wholeShares } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import { TrendMark } from "./trend-mark";

type DevicesCardProps = {
	/** The users with one event or more in the period, and in the period before. */
	activeUsers: { current: number; previous: number };
	/** The active users of the period per device kind. Each user counts on one platform. */
	devices: { computer: number; phone: number };
};

/** Each half of the bar has its name and its share above it, with a dot of its color. */
export function DevicesCard({ activeUsers, devices }: DevicesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	// Whole percents that add up to 100 %, so the two chips never read 99 % in total.
	const [computerShare = 0, phoneShare = 0] = wholeShares([
		devices.computer,
		devices.phone,
	]);
	const parts = [
		{
			key: "computer",
			label: t("overview.devices.computer"),
			share: computerShare,
			color: "bg-chart-1",
		},
		{
			key: "phone",
			label: t("overview.devices.phone"),
			share: phoneShare,
			color: "bg-chart-2",
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.devices.title")}</CardDescription>
				<p className="mb-6 font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{number.format(activeUsers.current)}
				</p>
				<CardAction>
					<TrendMark
						change={changeRatio(activeUsers.current, activeUsers.previous)}
					/>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid grid-cols-2 divide-x text-sm">
					{parts.map((part, index) => (
						<li
							key={part.key}
							className={
								index === 0
									? "flex min-w-0 items-center gap-2 pe-2"
									: "flex min-w-0 items-center justify-end gap-2 ps-2"
							}
						>
							<Badge
								variant="secondary"
								className="min-w-12 border border-border tabular-nums"
							>
								{percent.format(part.share)}
							</Badge>
							<span
								aria-hidden="true"
								className={`size-2 shrink-0 rounded-full ${part.color}`}
							/>
							<span className="truncate">{part.label}</span>
						</li>
					))}
				</ul>
				<div
					aria-hidden="true"
					className="mt-4 flex h-4 overflow-hidden rounded-md bg-muted"
				>
					{parts.map((part) => (
						<span
							key={part.key}
							className={part.color}
							style={{ width: `${part.share * 100}%` }}
						/>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
