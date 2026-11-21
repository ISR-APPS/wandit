// The "On-time delivery" card of the home: a donut of the done tasks of the period by delivery class.
// OverviewPage renders it beside the monthly card. A Select picks the class that the donut lifts and counts.
// Only done tasks with a due day count: a task with no promised day cannot be late.
import { lazy, Suspense, useState } from "react";
import { fillMessage } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { DELIVERY_CLASSES, type DeliveryClass } from "../lib/overview-data";

const OnTimeDonut = lazy(() =>
	import("./on-time-donut").then((module) => ({
		default: module.OnTimeDonut,
	})),
);

// The swatch colors repeat DELIVERY_COLORS of the donut file, which loads later.
const SWATCH = {
	early: "bg-chart-1",
	onTime: "bg-chart-2",
	late: "bg-chart-3",
	veryLate: "bg-chart-4",
} satisfies Record<DeliveryClass, string>;

type OnTimeCardProps = {
	/** Done tasks of the period with a due day, per delivery class. */
	counts: Record<DeliveryClass, number>;
	/** The period of the page, for example "30 days". */
	period: string;
};

/** The card opens on "On time", the class that the team aims for. */
export function OnTimeCard({ counts, period }: OnTimeCardProps) {
	const { t } = useT();
	const [active, setActive] = useState<DeliveryClass>("onTime");
	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>
					{fillMessage(t("period.last"), { period })}
				</CardDescription>
				<CardTitle className="font-display text-xl">
					{t("overview.onTimeTitle")}
				</CardTitle>
				<CardAction>
					<Select
						value={active}
						onValueChange={(value) => {
							const next = DELIVERY_CLASSES.find((key) => key === value);
							if (next) {
								setActive(next);
							}
						}}
					>
						<SelectTrigger
							aria-label={t("overview.deliveryClass")}
							className="w-auto"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{DELIVERY_CLASSES.map((key) => (
								<SelectItem key={key} value={key}>
									<span className="flex items-center gap-2 text-xs">
										<span
											aria-hidden="true"
											className={`size-3 shrink-0 rounded-sm ${SWATCH[key]}`}
										/>
										{t(`overview.delivery.${key}`)}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center">
				<Suspense
					fallback={
						<Skeleton className="aspect-square w-full max-w-60 rounded-full" />
					}
				>
					<OnTimeDonut counts={counts} active={active} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
