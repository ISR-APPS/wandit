// The opening furniture of every section: a small-caps label and a hairline that runs to the end edge.
// Each section component renders it above its title.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

type SectionLabelProps = {
	/** The ground under the label. It picks the label color and the hairline color. */
	tone: "ground" | "quiet" | "deep";
	className?: string;
	children: ReactNode;
};

const RULE_COLOR = {
	ground: "bg-border",
	quiet: "bg-foreground/12",
	deep: "bg-background/20",
} as const;

/** One line: the label, then a 1px rule. The same line opens each section, and that repeat is the calm of the page. */
export function SectionLabel({ tone, className, children }: SectionLabelProps) {
	return (
		<p
			className={cn(
				"mb-[clamp(28px,3.5vw,48px)] flex items-center gap-4",
				className,
			)}
		>
			{/* The deep band needs the lifted teal for contrast. Both light grounds take the deep teal. */}
			<span
				className={cn(
					LABEL,
					tone === "deep" ? "text-(--sp-teal-lift)" : "text-(--sp-teal-deep)",
				)}
			>
				{children}
			</span>
			<span
				aria-hidden="true"
				className={cn("h-px flex-1", RULE_COLOR[tone])}
			/>
		</p>
	);
}
