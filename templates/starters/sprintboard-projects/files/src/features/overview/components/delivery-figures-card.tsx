// The figures panel of the overview: the delivery figures that no entity row shows, as a ruled list.
// OverviewPage renders it beside the breakdown. Each figure has the delta pill of the kpi form "delta".
import { ChangePill } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KpiItem } from "../lib/overview-data";

type DeliveryFiguresCardProps = {
	/** At most 4 figures, with their labels already translated. */
	items: (KpiItem & { label: string; hint: string })[];
	/** The period text, for example "Last 30 days". */
	periodLabel: string;
};

/** One row per figure: the label and a short hint at the start, the value over its pill at the end. */
export function DeliveryFiguresCard({
	items,
	periodLabel,
}: DeliveryFiguresCardProps) {
	const { t, locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.deliveryTitle")}</CardTitle>
				<CardDescription>{periodLabel}</CardDescription>
			</CardHeader>
			<CardContent>
				<dl className="grid content-start divide-y">
					{items.map((item) => (
						<div
							key={item.id}
							className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-3.5 first:pt-0 last:pb-0"
						>
							<dt className="grid gap-0.5">
								<span className="font-medium text-sm">{item.label}</span>
								<span className="text-muted-foreground text-xs">
									{item.hint}
								</span>
							</dt>
							<dd className="grid justify-items-end gap-1.5">
								<span className="font-numeric font-semibold text-2xl tabular-nums leading-none">
									{new Intl.NumberFormat(locale, item.format).format(
										item.value,
									)}
								</span>
								{item.change === null ? (
									<span className="text-muted-foreground text-xs">
										{t("kpi.noComparison")}
									</span>
								) : (
									<ChangePill change={item.change} goodWhen={item.goodWhen} />
								)}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
