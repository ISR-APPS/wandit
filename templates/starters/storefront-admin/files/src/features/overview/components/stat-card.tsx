// One stat card of the home, kit variant "footer": the label and the change in one row, the value under them,
// and a "View more" link in a ruled footer. OverviewPage renders three of them beside the best day card.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { ChangeBadge } from "~/features/shop";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardFooter } from "~/shared/ui/card";

type StatCardProps = {
	/** The translated name of the figure, for example "Orders". */
	label: string;
	/** The figure, already formatted. */
	value: string;
	/** Ratio against the previous period: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news. */
	goodWhen: "up" | "down";
	/** The list page behind the figure. The footer link opens it. */
	to: "/app/orders" | "/app/customers";
};

/** The footer link reads "View more" and names the figure for screen readers. */
export function StatCard({
	label,
	value,
	change,
	goodWhen,
	to,
}: StatCardProps) {
	const { t } = useT();
	return (
		<Card className="gap-0 py-0">
			<CardContent className="grid gap-4 p-6">
				<div className="flex items-start justify-between gap-2">
					<span className="truncate text-muted-foreground text-sm">
						{label}
					</span>
					{change === null ? (
						<span className="shrink-0 text-muted-foreground text-xs">
							{t("kpi.noComparison")}
						</span>
					) : (
						<ChangeBadge
							change={change}
							goodWhen={goodWhen}
							look="text"
							className="shrink-0"
						/>
					)}
				</div>
				<p className="font-numeric text-3xl tabular-nums">{value}</p>
			</CardContent>
			<CardFooter className="justify-end border-t p-0">
				<Link
					to={to}
					className="flex items-center gap-2 rounded-md px-6 py-3 font-medium text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{t("overview.viewMore")}
					<span className="sr-only">{label}</span>
					<ArrowRightIcon className="size-4 rtl:rotate-180" />
				</Link>
			</CardFooter>
		</Card>
	);
}
