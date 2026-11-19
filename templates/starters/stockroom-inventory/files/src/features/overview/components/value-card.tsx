// The stock value card of the home: the value on the shelves per family, as a donut with the total in the hole.
// It takes the place of the kit "visits by source" card. OverviewPage renders it.
// The four largest families get a slice; the rest share one "Other" slice. The donut file loads with React.lazy.
import { lazy, Suspense } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { FamilyValue } from "../api/overview.queries";
import type { ValueSlice } from "./value-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ValueDonut = lazy(() =>
	import("./value-donut").then((module) => ({ default: module.ValueDonut })),
);

// Four slices and "Other" use the five chart colors of the theme.
const SHOWN_FAMILIES = 4;

type ValueCardProps = {
	/** One entry per family, the largest value first. */
	values: FamilyValue[];
	/** The grid span classes of the page. */
	className?: string;
};

/** The legend names each slice under the donut. The tooltip and the label of the chart give the values. */
export function ValueCard({ values, className }: ValueCardProps) {
	const { t } = useT();
	const slices: ValueSlice[] = [
		...values.slice(0, SHOWN_FAMILIES).map((family, index) => ({
			key: family.category,
			label: t(`categories.${family.category}`),
			value: family.value,
			color: `var(--chart-${index + 1})`,
		})),
		{
			key: "other",
			label: t("overview.otherFamilies"),
			value: values
				.slice(SHOWN_FAMILIES)
				.reduce((sum, family) => sum + family.value, 0),
			color: `var(--chart-${SHOWN_FAMILIES + 1})`,
		},
	];

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>{t("overview.valueTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<ValueDonut slices={slices} />
				</Suspense>
				<ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
					{slices.map((slice) => (
						<li
							key={slice.key}
							className="flex items-center gap-1.5 text-muted-foreground text-xs"
						>
							<span
								aria-hidden="true"
								className="size-2.5 shrink-0 rounded-sm"
								style={{ backgroundColor: slice.color }}
							/>
							{slice.label}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
