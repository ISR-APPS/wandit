// The breakdown part of the chart form "compare": billable hours by service line as one split bar and a ruled list.
// The overview tab renders it beside the figures card. The period is the period of the page.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { BreakdownSlice } from "../lib/series";

// The parts take the chart colors in order. A sixth part takes the muted color.
const SLICE_COLORS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
	"bg-muted-foreground",
] as const;

type ServiceBreakdownCardProps = {
	/** The panel title, already translated. */
	title: string;
	/** The parts, largest first, with translated labels. Values are hours. */
	slices: BreakdownSlice[];
};

/** The bar repeats the rows, so it is hidden from screen readers. */
export function ServiceBreakdownCard({
	title,
	slices,
}: ServiceBreakdownCardProps) {
	const { t, locale } = useT();
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const hours = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "hour",
		unitDisplay: "narrow",
		maximumFractionDigits: 0,
	});
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-5">
				<div
					aria-hidden="true"
					className="flex h-4 gap-0.5 overflow-hidden rounded-sm bg-muted"
				>
					{slices.map((slice, index) => (
						<div
							key={slice.label}
							className={cn(
								"h-full",
								SLICE_COLORS[index] ?? "bg-muted-foreground",
							)}
							style={{
								width: `${total === 0 ? 0 : (slice.value / total) * 100}%`,
							}}
						/>
					))}
				</div>
				{total === 0 ? (
					<p className="text-muted-foreground text-sm">{t("chart.empty")}</p>
				) : (
					<ul className="grid">
						{slices.map((slice, index) => (
							<li
								key={slice.label}
								className="grid grid-cols-[auto_1fr_auto_3rem] items-center gap-3 border-b py-2.5 text-sm last:border-b-0"
							>
								<span
									className={cn(
										"size-2.5 rounded-sm border border-foreground/20",
										SLICE_COLORS[index] ?? "bg-muted-foreground",
									)}
								/>
								<span>{slice.label}</span>
								<span className="font-medium tabular-nums">
									{hours.format(slice.value)}
								</span>
								<span className="text-end text-muted-foreground tabular-nums">
									{share.format(slice.value / total)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
