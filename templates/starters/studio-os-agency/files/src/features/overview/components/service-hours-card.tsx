// The service card of the home: billable hours of the period by service, as a donut with a service select.
// OverviewPage renders it in the third band. The donut file loads with React.lazy.
// The select picks the service of the outer arc and of the center value. It changes no query.
import { lazy, Suspense, useState } from "react";
import { SERVICES, type Service, useFormatters } from "~/features/studio";
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
import type { ServiceSlice } from "../lib/overview-data";
import type { ServiceDonutSlice } from "./service-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ServiceDonut = lazy(() =>
	import("./service-donut").then((module) => ({
		default: module.ServiceDonut,
	})),
);

type ServiceHoursCardProps = {
	/** Billable hours of the period per service, in the order of SERVICES. */
	slices: ServiceSlice[];
	/** The period line of the page, for example "Last 30 days". */
	periodLabel: string;
};

/** The select opens on the service with the most hours. */
export function ServiceHoursCard({
	slices,
	periodLabel,
}: ServiceHoursCardProps) {
	const { t } = useT();
	const { hours, number } = useFormatters();
	const largest = slices.reduce<ServiceSlice | null>(
		(best, slice) => (best === null || slice.value > best.value ? slice : best),
		null,
	);
	const [active, setActive] = useState<Service>(largest?.service ?? "branding");
	const donutSlices: ServiceDonutSlice[] = slices.map((slice, index) => ({
		service: slice.service,
		label: t(`codes.services.${slice.service}`),
		value: slice.value,
		// Five services, five chart series, in the order of SERVICES.
		color: `var(--chart-${index + 1})`,
	}));
	const activeValue =
		slices.find((slice) => slice.service === active)?.value ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardDescription>{periodLabel}</CardDescription>
				<CardTitle className="font-display text-xl">
					{t("overview.services.title")}
				</CardTitle>
				<CardAction>
					<Select
						value={active}
						onValueChange={(value) => {
							const next = SERVICES.find((service) => service === value);
							if (next) {
								setActive(next);
							}
						}}
					>
						<SelectTrigger
							className="w-auto gap-2"
							aria-label={t("overview.services.pick")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{donutSlices.map((slice) => (
								<SelectItem key={slice.service} value={slice.service}>
									<span
										className="size-3 shrink-0 rounded-sm"
										style={{ backgroundColor: slice.color }}
									/>
									{slice.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-1 items-center justify-center">
				<Suspense
					fallback={
						<Skeleton className="aspect-square w-full max-w-56 rounded-full" />
					}
				>
					<ServiceDonut
						slices={donutSlices}
						active={active}
						centerValue={number(activeValue)}
						centerCaption={t("overview.services.caption")}
						label={`${t("overview.services.title")}: ${donutSlices
							.map((slice) => `${slice.label} ${hours(slice.value)}`)
							.join(", ")}`}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
