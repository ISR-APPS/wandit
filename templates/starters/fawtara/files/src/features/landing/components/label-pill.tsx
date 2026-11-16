// The label pill: the small capital label that opens a section.
// SectionHead, HeroSection, StatsSection, and ContactSection render it.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

type LabelPillProps = {
	/** Extra classes, for example an entrance class. */
	className?: string;
	/** The label text, in sentence case. The pill draws it in capitals. */
	children: ReactNode;
};

/** A label never sits bare on the ground: it always has this sky pill. */
export function LabelPill({ className, children }: LabelPillProps) {
	return (
		<span
			className={cn(
				"inline-block rounded-full bg-accent px-4 py-[0.45em] font-bold font-display text-(--fw-blue-deep) text-[0.76rem] uppercase leading-normal tracking-[0.08em]",
				className,
			)}
		>
			{children}
		</span>
	);
}
