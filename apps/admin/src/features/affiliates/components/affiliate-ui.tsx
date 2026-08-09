import type { AffiliateCurrencyAggregate } from "@wandit/contracts";
import {
	AlertCircleIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
	formatAffiliateMoney,
	formatAffiliateNumber,
	titleCaseAffiliateValue,
} from "../lib/formatters";

type CurrencyMetric =
	| "attributedRevenueCents"
	| "pendingCommissionCents"
	| "approvedCommissionCents"
	| "paidCommissionCents"
	| "balanceCents";

export function CurrencyValues({
	currencies,
	metric,
	compact = false,
	empty = "—",
}: {
	currencies: AffiliateCurrencyAggregate[];
	metric: CurrencyMetric;
	compact?: boolean;
	empty?: string;
}) {
	if (currencies.length === 0) {
		return <span className="text-muted-foreground">{empty}</span>;
	}

	return (
		<div className="space-y-0.5">
			{currencies.map((currency) => (
				<div key={currency.currency} className="font-mono text-xs tabular-nums">
					{formatAffiliateMoney(currency[metric], currency.currency, compact)}
				</div>
			))}
		</div>
	);
}

const statusClass: Record<string, string> = {
	active:
		"border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	approved: "border-blue-500/25 bg-blue-500/8 text-blue-700 dark:text-blue-300",
	archived: "border-border bg-muted/60 text-muted-foreground",
	draft: "border-border bg-muted/60 text-muted-foreground",
	expired: "border-destructive/25 bg-destructive/8 text-destructive",
	failed: "border-destructive/25 bg-destructive/8 text-destructive",
	paid: "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
	paused: "border-border bg-muted/60 text-muted-foreground",
	pending:
		"border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
	processing:
		"border-blue-500/25 bg-blue-500/8 text-blue-700 dark:text-blue-300",
	reversed: "border-destructive/25 bg-destructive/8 text-destructive",
	voided: "border-destructive/25 bg-destructive/8 text-destructive",
};

export function AffiliateStatusBadge({ status }: { status: string }) {
	return (
		<Badge
			variant="outline"
			className={cn("whitespace-nowrap", statusClass[status])}
		>
			{titleCaseAffiliateValue(status)}
		</Badge>
	);
}

export function PaginationControls({
	page,
	pageSize,
	total,
	onPageChange,
}: {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
}) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-col gap-2 border-t px-4 py-3 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
			<span>
				{formatAffiliateNumber(from)}–{formatAffiliateNumber(to)} of{" "}
				{formatAffiliateNumber(total)}
			</span>
			<div className="flex items-center gap-2">
				<span>
					Page {page} of {pageCount}
				</span>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					<ChevronLeftIcon />
					<span className="sr-only">Previous page</span>
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					disabled={page >= pageCount}
					onClick={() => onPageChange(page + 1)}
				>
					<ChevronRightIcon />
					<span className="sr-only">Next page</span>
				</Button>
			</div>
		</div>
	);
}

export function AffiliateTableLoading({ columns = 6 }: { columns?: number }) {
	return (
		<div className="space-y-px rounded-lg border bg-border">
			{loadingRowKeys.map((rowKey) => (
				<div
					key={rowKey}
					className="grid gap-4 bg-background p-4"
					style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
				>
					{loadingColumnKeys.slice(0, columns).map((columnKey) => (
						<Skeleton key={`${rowKey}-${columnKey}`} className="h-5 w-full" />
					))}
				</div>
			))}
		</div>
	);
}

const loadingRowKeys = ["one", "two", "three", "four", "five", "six"];
const loadingColumnKeys = [
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"ten",
];

export function AffiliateSectionMessage({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex min-h-64 flex-col items-center justify-center rounded-xl border bg-background p-8 text-center">
			<div className="mb-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
				<AlertCircleIcon className="size-5" />
			</div>
			<h3 className="font-semibold text-sm">{title}</h3>
			<p className="mt-1 max-w-lg text-muted-foreground text-sm">
				{description}
			</p>
			{action ? <div className="mt-4">{action}</div> : null}
		</div>
	);
}
