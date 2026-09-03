import type { MonthlyCostEntry } from "@wandit/contracts";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useAdminPermission } from "@/features/auth/lib/permissions";
import {
	formatCostMoney,
	formatCostMonth,
	formatCostSource,
	formatCostUpdatedAt,
} from "@/features/costs/lib/cost-formatters";

type MonthlyCostsTableProps = {
	months: readonly MonthlyCostEntry[];
	onEdit: (entry: MonthlyCostEntry) => void;
	onDelete: (entry: MonthlyCostEntry) => void;
};

export function MonthlyCostsTable({
	months,
	onEdit,
	onDelete,
}: MonthlyCostsTableProps) {
	const canManage = useAdminPermission({ costs: ["manage"] });

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b py-6">
				<CardTitle>
					<h2>Monthly actuals</h2>
				</CardTitle>
				<CardDescription>
					Full-month values are prorated by UTC calendar day for analytics
					ranges that start or end mid-month.
				</CardDescription>
			</CardHeader>
			<CardContent className="p-0">
				{months.length === 0 ? (
					<div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
						<p className="font-medium">No monthly costs recorded</p>
						<p className="max-w-md text-muted-foreground text-sm">
							Add each month in the analytics range to unlock cost-derived
							metrics.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<Table className="min-w-[1120px]">
							<TableHeader className="bg-muted/20">
								<TableRow>
									<TableHead className="min-w-36 px-4">Month</TableHead>
									<TableHead className="min-w-72">Ad spend by source</TableHead>
									<TableHead className="text-right">Infrastructure</TableHead>
									<TableHead className="text-right">Other</TableHead>
									<TableHead className="text-right">Total</TableHead>
									<TableHead className="min-w-56">Notes</TableHead>
									<TableHead className="min-w-44">Updated</TableHead>
									<TableHead className="w-24 px-3 text-right">
										<span className="sr-only">Actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{months.map((entry) => (
									<TableRow key={entry.month}>
										<TableCell className="px-4 py-4 font-medium">
											<time dateTime={entry.month}>
												{formatCostMonth(entry.month)}
											</time>
										</TableCell>
										<TableCell>
											<SourceSpendChips entry={entry} />
										</TableCell>
										<MoneyCell cents={entry.infrastructureCostCents} />
										<MoneyCell cents={entry.otherCostCents} />
										<MoneyCell cents={entry.totalCostCents} emphasized />
										<TableCell>
											<p
												className="max-w-64 truncate text-muted-foreground text-sm"
												title={entry.notes ?? undefined}
											>
												{entry.notes || "—"}
											</p>
										</TableCell>
										<TableCell className="text-muted-foreground text-sm tabular-nums">
											<time dateTime={entry.updatedAt}>
												{formatCostUpdatedAt(entry.updatedAt)}
											</time>
										</TableCell>
										<TableCell className="px-3 text-right">
											{canManage ? (
												<div className="flex justify-end gap-1">
													<Button
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => onEdit(entry)}
														aria-label={`Edit ${formatCostMonth(entry.month)} costs`}
													>
														<PencilIcon aria-hidden="true" />
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="text-destructive hover:text-destructive"
														onClick={() => onDelete(entry)}
														aria-label={`Delete ${formatCostMonth(entry.month)} costs`}
													>
														<Trash2Icon aria-hidden="true" />
													</Button>
												</div>
											) : null}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function SourceSpendChips({ entry }: { entry: MonthlyCostEntry }) {
	const spendEntries = Object.entries(entry.adSpendBySourceCents).sort(
		([left], [right]) => left.localeCompare(right),
	);

	if (spendEntries.length === 0) {
		return <span className="text-muted-foreground text-sm">No ad spend</span>;
	}

	return (
		<div className="flex max-w-96 flex-wrap gap-1.5">
			{spendEntries.map(([source, cents]) => (
				<Badge key={source} variant="outline" className="font-normal">
					<span>{formatCostSource(source)}</span>
					<span className="font-mono tabular-nums">
						{formatCostMoney(cents)}
					</span>
				</Badge>
			))}
		</div>
	);
}

function MoneyCell({
	cents,
	emphasized = false,
}: {
	cents: number;
	emphasized?: boolean;
}) {
	return (
		<TableCell
			className={`text-right font-mono tabular-nums ${emphasized ? "font-semibold text-foreground" : "text-muted-foreground"}`}
		>
			{formatCostMoney(cents)}
		</TableCell>
	);
}
