// A rubber stamp: bold capitals in a double frame, tilted on the paper.
// The rows, the hero, the method band, and the slip render it. The frame and the tilt live in landing.css (.rn-stamp).
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

type StampProps = {
	children: ReactNode;
	/** Ink of the stamp: cobalt, red for "Sold" and cuts, or paper on the cobalt band. */
	tone?: "primary" | "destructive" | "paper";
	/** Size, padding, position, and entrance classes of this use. */
	className?: string;
};

const TONES = {
	primary: "text-primary",
	destructive: "text-destructive",
	paper: "text-background",
} as const;

/** Inline stamp. It is decoration, so screen readers skip it; the text next to it carries the same fact. */
export function Stamp({ children, tone = "primary", className }: StampProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"rn-stamp relative inline-block whitespace-nowrap font-extrabold font-sans uppercase leading-none tracking-[0.16em]",
				TONES[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}
