import { cn } from "@wandit/ui/lib/utils";
import { CreditCard, Gift, Hourglass, Zap } from "lucide-react";

import { relativeTime } from "@/lib/relative-time";
import { CREDITS_COPY } from "../lib/constants";
import { useCredits } from "../lib/hooks";
import type { LedgerKind } from "../lib/store";

const KIND_ICONS: Record<LedgerKind, typeof Gift> = {
	grant: Gift,
	consume: Zap,
	topup: CreditCard,
	expire: Hourglass,
};

type LedgerListProps = {
	limit?: number;
	className?: string;
};

export function LedgerList({ limit, className }: LedgerListProps) {
	const { ledger } = useCredits();
	const rows = limit === undefined ? ledger : ledger.slice(0, limit);

	if (rows.length === 0) {
		return (
			<p className={cn("px-2 py-1.5 text-muted-foreground text-xs", className)}>
				{CREDITS_COPY.emptyLedger}
			</p>
		);
	}

	return (
		<ul className={cn("flex flex-col", className)}>
			{rows.map((entry) => {
				const Icon = KIND_ICONS[entry.kind];
				return (
					<li
						key={entry.id}
						className="flex items-center gap-2 rounded-md px-2 py-1.5"
					>
						<Icon className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="min-w-0 flex-1 truncate text-xs">
							{entry.label}
						</span>
						<span
							className={cn(
								"font-mono text-xs tabular-nums",
								entry.amount > 0 ? "text-success" : "text-muted-foreground",
							)}
						>
							{entry.amount > 0 ? `+${entry.amount}` : entry.amount}
						</span>
						<span className="w-12 text-right font-mono text-[10px] text-muted-foreground/70">
							{relativeTime(entry.createdAt)}
						</span>
					</li>
				);
			})}
		</ul>
	);
}
