import type { AiChatSelectedTarget } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { Crosshair, X } from "lucide-react";

type TargetChipProps = {
	target: AiChatSelectedTarget;
	className?: string;
	/** Optional context announced before the visual tag/excerpt descriptor. */
	accessibleLabel?: string;
} & (
	| { onClear: () => void; clearLabel: string }
	| { onClear?: never; clearLabel?: never }
);

/** Shared target descriptor for pending Cibler and persisted user turns. */
export function TargetChip({
	target,
	className,
	accessibleLabel,
	onClear,
	clearLabel,
}: TargetChipProps) {
	const excerpt = target.excerpt?.trim();

	return (
		<span
			title={target.wid}
			className={cn(
				"flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 ps-2.5 pe-2 text-primary text-xs",
				className,
			)}
		>
			<Crosshair className="size-3 shrink-0" aria-hidden />
			{accessibleLabel ? (
				<span className="sr-only">{accessibleLabel}</span>
			) : null}
			<bdi dir="ltr" className="shrink-0 font-mono">
				{target.tag}
			</bdi>
			{excerpt ? (
				<>
					<span aria-hidden className="text-primary/50">
						·
					</span>
					<span dir="auto" className="min-w-0 truncate">
						{excerpt}
					</span>
				</>
			) : null}
			{onClear ? (
				<button
					type="button"
					aria-label={clearLabel}
					onClick={onClear}
					className="-me-1 grid size-5 shrink-0 place-items-center rounded-full transition-colors hover:bg-primary/10"
				>
					<X className="size-3" aria-hidden />
				</button>
			) : null}
		</span>
	);
}
