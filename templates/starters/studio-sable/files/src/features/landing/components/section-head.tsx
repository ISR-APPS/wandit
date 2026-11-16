// The head of a numbered section: a mono label, a hairline that draws from the start side, and an optional end slot.
// Each section below the hero renders it first. The cascade of use-cascade.ts animates its three parts.
import type { ReactNode } from "react";
import { MONO_LABEL } from "../lib/type-styles";

type SectionHeadProps = {
	/** The number and the name of the section, for example "04 — offers". Already translated. */
	label: string;
	/** The block at the end of the hairline: the section title, or a hint. On a phone it goes under the hairline. */
	children?: ReactNode;
};

/** One row on a wide screen. From 860px down, the label, the hairline, and the end slot stack. */
export function SectionHead({ label, children }: SectionHeadProps) {
	return (
		<div className="mb-[clamp(20px,3vh,36px)] grid gap-3 min-[861px]:flex min-[861px]:items-baseline min-[861px]:gap-3.5">
			<p className={`${MONO_LABEL} sable-fade`}>{label}</p>
			<span
				aria-hidden="true"
				className="sable-rule block h-px w-full min-w-6 bg-foreground/14 min-[861px]:w-auto min-[861px]:flex-1"
			/>
			{children}
		</div>
	);
}
