// One supplier as a card of the supplier grid: name, place, contact, families, and three delivery figures.
// The supplier page renders one per supplier. The whole card links to the supplier panel (?supplier=<id>).
import { Link } from "@tanstack/react-router";
import { moneyFormat, pluralForm } from "~/features/stock";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { Supplier } from "../api/suppliers.queries";

// Under 70 % on time, the buyer plans extra cover for this supplier. From 90 %, the record is good.
const WEAK_ON_TIME = 0.7;
const GOOD_ON_TIME = 0.9;

type SupplierCardProps = {
	supplier: Supplier;
};

/** The figures sit in a row of three. The status line at the bottom names open, late, and low counts. */
export function SupplierCard({ supplier }: SupplierCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale, true);
	const days = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "narrow",
	});

	return (
		<Link
			from="/app/suppliers"
			search={(previous) => ({ ...previous, supplier: supplier.id })}
			className="group rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Card className="h-full gap-5 transition-colors group-hover:bg-accent/40">
				<CardHeader>
					<CardTitle className="truncate">{supplier.name}</CardTitle>
					<p className="truncate text-muted-foreground text-sm">
						{`${supplier.city} · ${supplier.contactName}`}
					</p>
				</CardHeader>
				<CardContent className="grid flex-1 content-start gap-5">
					<div className="flex flex-wrap gap-1.5">
						{supplier.categories.map((category) => (
							<Badge key={category} variant="secondary">
								{t(`categories.${category}`)}
							</Badge>
						))}
					</div>
					<dl className="grid grid-cols-3 gap-3">
						<div className="grid content-start gap-1.5">
							<dt className="label-text text-muted-foreground text-xs">
								{t("suppliers.onTime")}
							</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{supplier.onTimeRate === null
									? t("items.none")
									: percent.format(supplier.onTimeRate)}
							</dd>
							<Progress
								value={Math.round((supplier.onTimeRate ?? 0) * 100)}
								aria-label={t("suppliers.onTime")}
								className={cn(
									"h-1",
									supplier.onTimeRate !== null &&
										supplier.onTimeRate < WEAK_ON_TIME &&
										"[&>[data-slot=progress-indicator]]:bg-warning",
									supplier.onTimeRate !== null &&
										supplier.onTimeRate >= GOOD_ON_TIME &&
										"[&>[data-slot=progress-indicator]]:bg-success",
								)}
							/>
						</div>
						<div className="grid content-start gap-1.5">
							<dt className="label-text text-muted-foreground text-xs">
								{t("suppliers.leadTime")}
							</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{days.format(supplier.leadTimeDays)}
							</dd>
						</div>
						<div className="grid content-start gap-1.5">
							<dt className="label-text text-muted-foreground text-xs">
								{t("suppliers.ordered90")}
							</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{money.format(supplier.orderedValue)}
							</dd>
						</div>
					</dl>
					<p className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-muted-foreground text-xs">
						<span className="tabular-nums">
							{`${number.format(supplier.openOrders)} ${t(`suppliers.openOrders.${pluralForm(supplier.openOrders, locale)}`)}`}
						</span>
						<span className="tabular-nums">
							{`${number.format(supplier.itemCount)} ${t(`suppliers.items.${pluralForm(supplier.itemCount, locale)}`)}`}
						</span>
						{supplier.lateOrders > 0 ? (
							<Badge variant="destructive">
								{`${number.format(supplier.lateOrders)} ${t("suppliers.late")}`}
							</Badge>
						) : null}
						{supplier.itemsBelowMinimum > 0 ? (
							<Badge variant="warning">
								{`${number.format(supplier.itemsBelowMinimum)} ${t("suppliers.belowMinimum")}`}
							</Badge>
						) : null}
					</p>
				</CardContent>
			</Card>
		</Link>
	);
}
