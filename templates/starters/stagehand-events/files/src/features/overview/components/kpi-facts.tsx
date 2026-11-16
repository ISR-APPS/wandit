// The facts row of the home: four figures in one ruled row with no panels, under the revenue hero.
// OverviewPage renders it with the KPI rows of overviewKpisQueryOptions, already translated.
// Each figure has its label, its value, its change, and a spark when it counts events per day.
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import type { KpiItem } from "../lib/series";
import { KpiDelta } from "./kpi-delta";
import { KpiSpark } from "./kpi-spark";

type KpiFactsProps = {
	/** The figures, in order of importance. */
	items: KpiItem[];
};

/** The wrapper clips the start rule of the first figure of each line, also after a wrap. */
export function KpiFacts({ items }: KpiFactsProps) {
	const { locale } = useT();
	return (
		<div className="overflow-hidden">
			{/* The negative margin is the ps-6 padding plus the 1 px rule, so the first rule sits outside the clip. */}
			<dl className="-ms-[calc(var(--spacing)*6+1px)] flex flex-wrap gap-y-6">
				{items.map((item) => (
					<div
						key={item.id}
						className="flex @4xl/main:flex-1 basis-1/2 flex-col gap-1.5 border-s ps-6 pe-6"
					>
						<dt className="label-text text-muted-foreground text-sm">
							{item.label}
						</dt>
						<dd className="font-numeric text-3xl tabular-nums">
							{new Intl.NumberFormat(locale, item.format).format(item.value)}
						</dd>
						<dd>
							<KpiDelta change={item.change} goodWhen={item.goodWhen} />
						</dd>
						{item.series ? (
							<dd className="pt-1">
								<KpiSpark
									series={item.series}
									isRate={item.format?.style === "percent"}
								/>
							</dd>
						) : null}
					</div>
				))}
			</dl>
		</div>
	);
}

// Placeholder keys of the skeleton. Fixed keys, because the figures never reorder.
const SKELETON_FACTS = ["1", "2", "3", "4"];

/** The facts row while the loader runs: the four parts of each figure at their final sizes. */
export function KpiFactsSkeleton() {
	return (
		<div className="grid @4xl/main:grid-cols-4 grid-cols-2 gap-6">
			{SKELETON_FACTS.map((key) => (
				<div key={key} className="grid gap-2">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-3 w-32" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}
		</div>
	);
}
