import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";

type PriceTagProps = {
	cost: number;
	withIcon?: boolean;
	className?: string;
};

/** "10 credits" in the mono ledger voice. Muted by default; restyle via className. */
export function PriceTag({ cost, withIcon = false, className }: PriceTagProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 font-medium font-mono text-muted-foreground text-xs tabular-nums",
				className,
			)}
		>
			{withIcon ? <Spark className="size-3" /> : null}
			{cost} {cost === 1 ? "credit" : "credits"}
		</span>
	);
}
