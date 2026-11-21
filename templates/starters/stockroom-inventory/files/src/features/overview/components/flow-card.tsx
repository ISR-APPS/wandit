// The stock in and out card of the home: units received and units picked per few days, as grouped bars,
// with the two totals of the period in a box at the head. It takes the place of the kit "total revenue" card.
// OverviewPage renders it. The chart file loads with React.lazy.
import { lazy, Suspense } from "react";
import { fillMessage } from "~/features/stock";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { FlowBucket } from "../api/overview.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const FlowBars = lazy(() =>
	import("./flow-bars").then((module) => ({ default: module.FlowBars })),
);

type FlowCardProps = {
	/** The bar groups of the period, oldest first. */
	flow: FlowBucket[];
	/** The period in words, for example "30 days". */
	period: string;
};

/** The totals box shows the sums of the bars, so the two numbers and the chart always agree. */
export function FlowCard({ flow, period }: FlowCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const unitsIn = flow.reduce((sum, bucket) => sum + bucket.unitsIn, 0);
	const unitsOut = flow.reduce((sum, bucket) => sum + bucket.unitsOut, 0);
	const totals = [
		{ label: t("overview.unitsIn"), value: unitsIn },
		{ label: t("overview.unitsOut"), value: unitsOut },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.flowTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.flowDescription"), { period })}
				</CardDescription>
				<CardAction>
					<dl className="flex gap-6 rounded-md border px-4 py-3">
						{totals.map((total) => (
							<div key={total.label} className="grid gap-1.5">
								<dt className="text-muted-foreground text-xs">{total.label}</dt>
								<dd className="font-numeric font-semibold @4xl/main:text-2xl text-xl tabular-nums leading-none">
									{number.format(total.value)}
								</dd>
							</div>
						))}
					</dl>
				</CardAction>
			</CardHeader>
			<CardContent className="mt-auto">
				<Suspense fallback={<Skeleton className="h-64 w-full" />}>
					<FlowBars flow={flow} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
