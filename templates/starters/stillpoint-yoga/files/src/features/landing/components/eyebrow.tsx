// The numbered label above each section title: "01 · The practices", with a sage hairline before it.
// The section components render it. A centered eyebrow gets a second hairline after the text.
import { cn } from "~/shared/lib/utils";

type EyebrowProps = {
	children: string;
	/** True for a centered section head: the label gets a hairline on both sides. */
	centered?: boolean;
	className?: string;
};

/** A tracked sage label. The hairlines are 34px wide and never shrink. */
export function Eyebrow({
	children,
	centered = false,
	className,
}: EyebrowProps) {
	return (
		<span
			className={cn(
				"flex items-center gap-3.5 font-bold font-sans text-[0.72rem] text-primary uppercase leading-[1.4] tracking-[0.26em]",
				centered && "justify-center text-center",
				className,
			)}
		>
			<span
				aria-hidden="true"
				className="h-px w-[34px] shrink-0 bg-(--sp-sage)"
			/>
			{children}
			{centered ? (
				<span
					aria-hidden="true"
					className="h-px w-[34px] shrink-0 bg-(--sp-sage)"
				/>
			) : null}
		</span>
	);
}
