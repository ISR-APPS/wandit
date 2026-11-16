// The head of a numbered section: an ink rule, the number tag, the title, and a short note at the end side.
// RegisterSection, DistrictsSection, MethodSection, NumbersSection, and SellSection render it.
import { cn } from "~/shared/lib/utils";
import { DISPLAY, LABEL } from "../lib/type-styles";

type SectionHeadProps = {
	/** "01 — The register" and the like. */
	tag: string;
	title: string;
	note: string;
	/** Id of the h2, for the aria-labelledby of the section. */
	titleId: string;
	/** True on the cobalt band: the rule takes the paper color. */
	onPrimary?: boolean;
	/** True hides the title on screen and keeps it for screen readers. The numbers band shows no title, as the board does. */
	isTitleHidden?: boolean;
};

/** Ruled head. Wide screen: tag and note share the first row, the title fills the second. Phone: tag, title, note. */
export function SectionHead({
	tag,
	title,
	note,
	titleId,
	onPrimary = false,
	isTitleHidden = false,
}: SectionHeadProps) {
	return (
		<div
			className={cn(
				"mb-[clamp(28px,4vw,52px)] flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t-2 pt-3.5",
				onPrimary ? "border-background" : "border-foreground",
			)}
		>
			<p className={cn(LABEL, "order-1 flex items-center gap-2")}>
				<span
					aria-hidden="true"
					className={cn(
						"inline-block size-2",
						onPrimary ? "bg-background" : "bg-primary",
					)}
				/>
				{tag}
			</p>
			<h2
				id={titleId}
				className={cn(
					DISPLAY,
					"order-2 text-[clamp(42px,6vw,96px)] leading-[0.92] md:order-3",
					isTitleHidden ? "sr-only" : "w-full text-balance",
				)}
			>
				{title}
			</h2>
			<p className="order-3 max-w-[40ch] text-pretty text-[13px] leading-normal md:order-2 md:text-end">
				{note}
			</p>
		</div>
	);
}
