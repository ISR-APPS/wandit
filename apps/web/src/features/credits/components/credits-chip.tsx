import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { SIGNUP_GRANT } from "../lib/constants";
import { useCredits } from "../lib/hooks";
import { LedgerList } from "./ledger-list";

export function CreditsChip({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { balance } = useCredits();
	const usedRatio = Math.min(Math.max(balance / SIGNUP_GRANT, 0), 1);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={t("credits.chipAriaLabel")}
					className={cn(
						// The one place ember appears as an outline instead of a fill
						// (DESIGN.md, Credits Pill): no fill, ember-tinted border, ember text.
						"inline-flex h-8 items-center rounded-full border border-primary/35 bg-transparent px-3 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
						className,
					)}
				>
					<span className="text-[13px] text-ember-text">
						{t("credits.creditUnit", { count: balance })}
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64 p-0">
				<div className="px-4 pt-4 pb-3">
					<p className="text-muted-foreground text-xs">
						{t("credits.balanceLabel")}
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
						{t("credits.usageOf", { balance, grant: SIGNUP_GRANT })}
					</p>
				</div>
				<DropdownMenuSeparator />
				<div className="px-2 py-2">
					<p className="px-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-widest">
						{t("credits.recentActivity")}
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
						{t("credits.topUpChip")}
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
