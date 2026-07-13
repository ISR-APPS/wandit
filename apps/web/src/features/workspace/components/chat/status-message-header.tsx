import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

export function StatusMessageHeader({
	avatarClass,
	kickerClass,
	kicker,
	children,
}: {
	avatarClass: string;
	kickerClass: string;
	kicker: string;
	children: ReactNode;
}) {
	return (
		<>
			<div className="mb-2 flex items-center gap-2">
				<span
					className={cn(
						"grid size-[22px] shrink-0 place-items-center rounded-full border",
						avatarClass,
					)}
				>
					{children}
				</span>
				<span className="font-medium text-foreground text-sm">Wandit</span>
			</div>
			<div
				className={cn(
					"mb-2 font-mono text-[11px] uppercase tracking-[0.1em]",
					kickerClass,
				)}
			>
				{kicker}
			</div>
		</>
	);
}
