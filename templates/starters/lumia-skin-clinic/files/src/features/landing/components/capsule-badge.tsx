// A capsule glyph-badge: the petal glyph and a small capital label inside a soft pill with a cacao hairline.
// Every section of the home page renders it. In this world a small label never floats bare on the ground.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { PetalGlyph } from "./petal-glyph";

type CapsuleBadgeProps = {
	/** The label text, already translated. */
	children: ReactNode;
	/** "blush" on cream grounds. "cream" is the quieter fill, for blush grounds and section labels. */
	tone?: "blush" | "cream";
	/** Extra classes, for example the scrub hooks of the hero badges. */
	className?: string;
	/** Extra classes of the glyph, for example its turn during the hero scrub. */
	glyphClassName?: string;
};

/** A non-interactive <span>. Put it in a list item or a caption when it names a fact. */
export function CapsuleBadge({
	children,
	tone = "blush",
	className,
	glyphClassName,
}: CapsuleBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex w-fit items-center gap-2 rounded-full border border-(--lumia-hair) px-[15px] py-2 font-semibold text-[11px] text-foreground uppercase leading-[1.2] tracking-[0.15em]",
				tone === "blush" ? "bg-(--lumia-blush)/62" : "bg-card/45",
				className,
			)}
		>
			<span className={cn("inline-flex shrink-0", glyphClassName)}>
				<PetalGlyph className="size-[13px] text-primary" />
			</span>
			{children}
		</span>
	);
}
