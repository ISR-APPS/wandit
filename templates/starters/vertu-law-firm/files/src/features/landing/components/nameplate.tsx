// The brass nameplate with exactly four screw heads: the identity object of the firm.
// The hero, the team door plates, and the access note render it at three scales.
// landing.css draws the flat brass, the screws, and their slots.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { LABEL } from "../lib/type-styles";

/** The scale of a plate: the hero plate, a door plate, or the small plate of the access note. */
type PlateSize = "large" | "door" | "small";

type NameplateProps = {
	/** The engraved name, in the display serif at weight 700. */
	name: ReactNode;
	/** The line under the name, in small caps. */
	sub: ReactNode;
	size?: PlateSize;
	className?: string;
};

const SIZE_CLASS: Record<PlateSize, string> = {
	large: "px-[clamp(1.7rem,3vw,3rem)] py-[clamp(1.5rem,2.4vw,1.9rem)]",
	door: "flex min-h-20 flex-col justify-center px-6 py-4 sm:min-h-26 sm:px-7 sm:py-5",
	small: "vt-plate-small px-6 py-4",
};

const NAME_CLASS: Record<PlateSize, string> = {
	large: "text-[clamp(1.25rem,1.9vw,1.6rem)]",
	door: "text-[clamp(1.05rem,1.32vw,1.28rem)]",
	small: "text-[1.02rem]",
};

/** A filled brass plate. The four screws are decorative and hidden from assistive technology. */
export function Nameplate({
	name,
	sub,
	size = "door",
	className,
}: NameplateProps) {
	return (
		<div className={cn("vt-plate", SIZE_CLASS[size], className)}>
			<span aria-hidden="true" className="vt-screw vt-screw-tl" />
			<span aria-hidden="true" className="vt-screw vt-screw-tr" />
			<span aria-hidden="true" className="vt-screw vt-screw-bl" />
			<span aria-hidden="true" className="vt-screw vt-screw-br" />
			<span
				className={cn(
					"block font-bold font-display leading-[1.18] tracking-[0.01em]",
					NAME_CLASS[size],
				)}
			>
				{name}
			</span>
			<span
				className={cn(
					LABEL,
					"vt-plate-sub mt-2 block text-[10.5px] leading-normal",
				)}
			>
				{sub}
			</span>
		</div>
	);
}
