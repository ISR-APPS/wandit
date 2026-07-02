import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";
import { CREDITS_COPY, SIGNUP_GRANT } from "../lib/constants";
import { useCredits } from "../lib/hooks";
import { LedgerList } from "./ledger-list";

export function CreditsChip({ className }: { className?: string }) {
	const { balance } = useCredits();
	const usedRatio = Math.min(Math.max(balance / SIGNUP_GRANT, 0), 1);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={CREDITS_COPY.chipAriaLabel}
					className={cn(
						"inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						className,
					)}
				>
					<Spark className="size-3.5 text-primary" />
					<span className="font-medium font-mono text-xs tabular-nums">
						{balance}
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64 p-0">
				<div className="px-4 pt-4 pb-3">
					<p className="text-muted-foreground text-xs">
						{CREDITS_COPY.balanceLabel}
					</p>
					<p className="mt-1 font-medium font-mono text-2xl tabular-nums">
						{balance}
					</p>
					<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-gradient-ember transition-[width] duration-300"
							style={{ width: `${usedRatio * 100}%` }}
						/>
					</div>
					<p className="mt-1.5 font-mono text-[10px] text-muted-foreground tabular-nums">
						{CREDITS_COPY.usageOf(balance, SIGNUP_GRANT)}
					</p>
				</div>
				<DropdownMenuSeparator />
				<div className="px-2 py-2">
					<p className="px-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-widest">
						{CREDITS_COPY.recentActivity}
					</p>
					<LedgerList limit={3} />
				</div>
				<DropdownMenuSeparator />
				<div className="p-2">
					<Button
						type="button"
						variant="secondary"
						size="sm"
						disabled
						className="w-full"
					>
						{CREDITS_COPY.topUpChip}
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
