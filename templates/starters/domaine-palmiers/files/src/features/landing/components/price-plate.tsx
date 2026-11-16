// The price plate: an ivory plate that straddles a top corner of a photo, with a label and a price.
// The hero and the villa cards render it inside a photo frame. It is flat: no shadow.
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

type PricePlateProps = {
	/** The small bronze line, for example "From". Already translated. */
	label: string;
	/** The serif figure, for example "98,000,000 DA" or "On request". Already translated. */
	value: string;
	/** The top corner of the photo that the plate sits on. "start" is the left corner in English. */
	corner: "start" | "end";
	className?: string;
};

/** The plate hangs 22px above the photo, so its top edge sits on the ground and the rest on the photo. */
export function PricePlate({
	label,
	value,
	corner,
	className,
}: PricePlateProps) {
	return (
		<div
			className={cn(
				"dlp-plate absolute -top-[22px] z-3 max-w-[min(calc(100%-32px),340px)] border border-foreground/24 bg-background px-[clamp(0.9rem,1.6vw,1.35rem)] pt-[0.8rem] pb-[0.95rem]",
				corner === "start"
					? "start-[clamp(16px,3vw,36px)]"
					: "end-[clamp(16px,4vw,56px)]",
				className,
			)}
		>
			<span className={cn(LABEL, "block")}>{label}</span>
			<span className="mt-[0.34rem] block whitespace-nowrap font-display text-[clamp(1.1rem,1.75vw,1.62rem)] leading-[1.12]">
				{value}
			</span>
		</div>
	);
}
