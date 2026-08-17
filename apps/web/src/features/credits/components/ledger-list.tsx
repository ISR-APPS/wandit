import type { CreditKind, CreditLedgerRow } from "@wandit/contracts";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import {
	CircleMinus,
	CreditCard,
	Gift,
	Hourglass,
	type LucideIcon,
	Zap,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import { formatCreditAmount } from "../lib/format-credits";

const KIND_ICONS: Record<CreditKind, LucideIcon> = {
	grant: Gift,
	consume: Zap,
	topup: CreditCard,
	expire: Hourglass,
	revoke: CircleMinus,
};

const LEDGER_SKELETON_KEYS = ["one", "two", "three", "four", "five"];

type LedgerListProps = {
	entries: readonly CreditLedgerRow[];
	isError?: boolean;
	isPending?: boolean;
	compact?: boolean;
	className?: string;
};

export function LedgerList({
	entries,
	isError = false,
	isPending = false,
	compact = false,
	className,
}: LedgerListProps) {
	const { locale, t } = useTranslation();

	if (isPending) {
		return (
			<div className={cn("flex flex-col", className)} aria-hidden>
				{LEDGER_SKELETON_KEYS.slice(0, compact ? 3 : 5).map((key) => (
					<div key={key} className="flex items-center gap-3 px-2 py-2">
						<Skeleton className="size-7 shrink-0 rounded-full" />
						<div className="min-w-0 flex-1 space-y-1.5">
							<Skeleton className="h-3 w-28" />
							<Skeleton className="h-2.5 w-16" />
						</div>
						<Skeleton className="h-3 w-10" />
					</div>
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p
				role="alert"
				className={cn("px-2 py-3 text-muted-foreground text-xs", className)}
			>
				{t("credits.ledgerLoadError")}
			</p>
		);
	}

	if (entries.length === 0) {
		return (
			<p className={cn("px-2 py-3 text-muted-foreground text-xs", className)}>
				{t("credits.emptyLedger")}
			</p>
		);
	}

	return (
		<ul className={cn("flex flex-col divide-y divide-border/65", className)}>
			{entries.map((entry) => {
				const Icon = KIND_ICONS[entry.kind];
				const positive = entry.delta > 0;

				return (
					<li
						key={entry.id}
						className={cn(
							"flex items-center gap-3 px-2",
							compact ? "py-2" : "py-3",
						)}
					>
						<span
							className={cn(
								"grid size-7 shrink-0 place-items-center rounded-full border",
								positive
									? "border-success/25 bg-success/8 text-success"
									: "border-border bg-muted/55 text-muted-foreground",
							)}
						>
							<Icon className="size-3.5" aria-hidden />
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate text-xs">
								{t(`credits.ledgerKinds.${entry.kind}`)}
							</p>
							<p className="mt-0.5 text-[10px] text-muted-foreground">
								{t(`credits.buckets.${entry.bucket}`)} ·{" "}
								{relativeTime(entry.createdAt)}
							</p>
						</div>
						<span
							dir="ltr"
							className={cn(
								"shrink-0 font-mono text-xs tabular-nums",
								positive ? "text-success" : "text-muted-foreground",
							)}
						>
							{positive ? "+" : ""}
							{formatCreditAmount(entry.delta, locale)}
						</span>
					</li>
				);
			})}
		</ul>
	);
}
