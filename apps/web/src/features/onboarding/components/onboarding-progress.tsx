import { cn } from "@wandit/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";

type OnboardingProgressProps = {
	currentIndex: number;
	total: number;
	className?: string;
};

export function OnboardingProgress({
	currentIndex,
	total,
	className,
}: OnboardingProgressProps) {
	const safeTotal = Math.max(total, 1);
	const safeIndex = Math.min(Math.max(currentIndex, 0), safeTotal - 1);

	return (
		<div
			aria-hidden
			className={cn("flex flex-col items-center gap-2.5", className)}
		>
			<div className="h-1 w-20 overflow-hidden rounded-full bg-border">
				<motion.span
					initial={false}
					animate={{ scaleX: (safeIndex + 1) / safeTotal }}
					transition={{ type: "spring", stiffness: 280, damping: 28 }}
					className="block h-full w-full origin-left rounded-full bg-gradient-ember rtl:origin-right"
				/>
			</div>

			<div className="relative flex h-2 items-center gap-1.5">
				<AnimatePresence initial={false} mode="popLayout">
					{Array.from({ length: safeTotal }, (_, index) => {
						const active = index === safeIndex;
						const done = index < safeIndex;

						return (
							<motion.span
								// biome-ignore lint/suspicious/noArrayIndexKey: each key represents a stable ordinal step in the progress scale.
								key={index}
								layout
								initial={{ opacity: 0, scale: 0.5, width: 0 }}
								animate={{ opacity: 1, scale: 1, width: active ? 24 : 8 }}
								exit={{ opacity: 0, scale: 0.5, width: 0 }}
								transition={{ type: "spring", stiffness: 400, damping: 30 }}
								className={cn(
									"block h-2 shrink-0 rounded-full",
									active
										? "bg-gradient-ember"
										: done
											? "bg-primary/50"
											: "bg-border",
								)}
							/>
						);
					})}
				</AnimatePresence>
			</div>
		</div>
	);
}
