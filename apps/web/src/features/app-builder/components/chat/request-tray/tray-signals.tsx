/**
 * Small visuals of the request tray: the spinning ember arc of an upload in
 * progress (a copy of the V1 tray), and the chip in the thread that points
 * at the tray on the composer. Rendered by tray-bodies.tsx and
 * question-receipt.tsx. The caller passes the copy.
 */

import { ArrowDownIcon } from "@phosphor-icons/react/ArrowDown";
import { cn } from "@wandit/ui/lib/utils";

/** Spinning ember arc on a stone track: the tray working marker. */
export function SpinnerArc({ className }: { className?: string }) {
	return (
		<svg
			className={cn(
				"size-[15px] shrink-0 animate-spin motion-reduce:animate-none",
				className,
			)}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden
			role="presentation"
		>
			<circle cx="12" cy="12" r="9" stroke="var(--stone)" strokeWidth="2.5" />
			<path
				d="M12 3a9 9 0 0 1 9 9"
				stroke="var(--primary)"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** Spark chip next to an open question in the thread: it points at the tray below. */
export function TrayPointerChip({
	label,
	className,
}: {
	label: string;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-spark/[0.16] ps-2 pe-2.5 font-grotesk font-medium text-[12px] text-night dark:bg-spark/[0.14] dark:text-foreground",
				className,
			)}
		>
			<ArrowDownIcon
				weight="bold"
				aria-hidden
				className="size-3 shrink-0 text-spark-deep dark:text-spark"
			/>
			{label}
		</span>
	);
}
