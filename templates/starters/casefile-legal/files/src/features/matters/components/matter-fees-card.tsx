// The fees of one matter: the use of the fee estimate (hourly) or the flat fee, then billed, paid, and open amounts.
// MatterDetailPage renders it first in the rail. The sums come from the ledger of the matter.
import { fillMessage, moneyFormat } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { MatterSummary } from "../lib/matter-joins";

// From this share of the estimate, the firm warns the client before more work. A product rule of the firm.
const ESTIMATE_WARNING_SHARE = 0.9;

type MatterFeesCardProps = {
	matter: MatterSummary;
};

/** An hourly matter compares billed and unbilled time with its estimate. A flat matter shows its one fee. */
export function MatterFeesCard({ matter }: MatterFeesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const { ledger } = matter;
	const used = ledger.billed + ledger.unbilled;
	const share = matter.budget ? used / matter.budget : null;
	const rows = [
		{ key: "billed", label: t("matters.billed"), value: ledger.billed },
		{ key: "paid", label: t("matters.paid"), value: ledger.paid },
		{
			key: "outstanding",
			label: t("matters.outstanding"),
			value: ledger.outstanding,
		},
		...(matter.flatFee === null
			? [
					{
						key: "unbilled",
						label: t("matters.unbilled"),
						value: ledger.unbilled,
					},
				]
			: []),
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.fees")}</CardTitle>
				<CardDescription>
					{t(
						matter.flatFee === null
							? "matters.budgetHint"
							: "matters.flatFeeHint",
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				{matter.budget !== null && share !== null ? (
					<div className="grid gap-2">
						<div className="flex items-baseline justify-between gap-3">
							<span className="text-muted-foreground text-sm">
								{t("matters.budget")}
							</span>
							<span className="font-numeric font-semibold text-xl tabular-nums">
								{money.format(matter.budget)}
							</span>
						</div>
						<Progress value={used} max={matter.budget} />
						<p
							className={cn(
								"text-xs",
								share >= ESTIMATE_WARNING_SHARE
									? "font-medium text-warning"
									: "text-muted-foreground",
							)}
						>
							{fillMessage(t("matters.budgetUsed"), {
								percent: percent.format(share),
							})}
						</p>
					</div>
				) : matter.flatFee !== null ? (
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-muted-foreground text-sm">
							{t("matters.fee")}
						</span>
						<span className="font-numeric font-semibold text-xl tabular-nums">
							{money.format(matter.flatFee)}
						</span>
					</div>
				) : null}
				<dl className="grid gap-2 border-t pt-4 text-sm">
					{rows.map((row) => (
						<div key={row.key} className="flex justify-between gap-3">
							<dt className="text-muted-foreground">{row.label}</dt>
							<dd className="tabular-nums">{money.format(row.value)}</dd>
						</div>
					))}
					{ledger.overdue > 0 ? (
						<div className="flex justify-between gap-3 font-medium text-destructive">
							<dt>{t("matters.overdue")}</dt>
							<dd className="tabular-nums">{money.format(ledger.overdue)}</dd>
						</div>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
}
