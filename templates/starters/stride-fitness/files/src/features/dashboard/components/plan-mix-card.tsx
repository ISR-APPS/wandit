// The plan mix card of the home: the active members per plan, as a donut with a 2 x 2 grid of plan tiles.
// DashboardPage renders it beside the check-ins card. "Export" downloads the count of every plan as CSV.
// It follows recipe 3.1 of the kit system, finance variant: the tiles under the donut name each slice.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { downloadCsv, planOf, toCsv } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { PlanSlice } from "../lib/summary";
import type { PlanMixSlice } from "./plan-mix-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const PlanMixDonut = lazy(() =>
	import("./plan-mix-donut").then((module) => ({
		default: module.PlanMixDonut,
	})),
);

// The donut shows the 3 largest plans and one "Other plans" slice, so the tiles fill a 2 x 2 grid.
const SHOWN_PLANS = 3;

type PlanMixCardProps = {
	/** Active members per plan, the largest plan first. One entry per plan, also at 0. */
	planMix: PlanSlice[];
};

/** Each tile names its slice and its count, so the color is never the only mark. */
export function PlanMixCard({ planMix }: PlanMixCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = planMix.reduce((sum, slice) => sum + slice.members, 0);
	const slices: PlanMixSlice[] = [
		...planMix.slice(0, SHOWN_PLANS).map((slice, index) => ({
			key: slice.planId,
			label: planOf(slice.planId).name,
			value: slice.members,
			// The chart series 1 to 3 color the largest plans, series 4 colors "Other plans".
			color: `var(--chart-${index + 1})`,
		})),
		{
			key: "other",
			label: t("dashboard.otherPlans"),
			value: planMix
				.slice(SHOWN_PLANS)
				.reduce((sum, slice) => sum + slice.members, 0),
			color: `var(--chart-${SHOWN_PLANS + 1})`,
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.planMixTitle")}</CardTitle>
				<CardDescription>{t("dashboard.planMixDescription")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							downloadCsv(
								"plan-mix.csv",
								toCsv(
									planMix.map((slice) => ({ id: slice.planId, ...slice })),
									[
										{
											header: t("members.plan"),
											value: (row) => planOf(row.planId).name,
										},
										{
											header: t("dashboard.activeCaption"),
											value: (row) => String(row.members),
										},
									],
								),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("common.export")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<PlanMixDonut slices={slices} total={total} />
				</Suspense>
				<ul className="grid grid-cols-2 gap-2">
					{slices.map((slice) => (
						<li
							key={slice.key}
							className="flex min-w-0 items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm"
						>
							<span
								aria-hidden="true"
								className="mt-1.5 size-2 shrink-0 rounded-full"
								style={{ backgroundColor: slice.color }}
							/>
							<span className="min-w-0 flex-1 text-pretty">{slice.label}</span>
							<span className="font-numeric font-semibold tabular-nums">
								{number.format(slice.value)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
