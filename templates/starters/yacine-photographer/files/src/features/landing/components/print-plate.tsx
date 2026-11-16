// One paper print for sale: a photograph inside a white paper margin, with its size, edition, and price printed on the paper.
// prints-section.tsx renders three of them. It reads one Print of lib/content.ts.
// The paper is the only light surface of the page.
import { useT } from "~/shared/i18n";
import type { Print } from "../lib/content";
import { PhotoFrame } from "./photo-frame";

type PrintPlateProps = {
	print: Print;
};

/**
 * Ink and ground swap on paper: the type is in the page ground color.
 * Below 641px the last plate spans the two phone columns, and its photograph turns 16:9.
 */
export function PrintPlate({ print }: PrintPlateProps) {
	const { t } = useT();
	return (
		<article className="group/plate bg-foreground px-[9px] pt-[9px] text-background max-[640px]:last:col-span-2">
			<PhotoFrame
				photo={print.photo}
				exif="standard"
				className={`${print.ratio} max-[640px]:group-last/plate:aspect-video`}
			/>
			<div className="grid gap-1 px-0.5 pt-2.5 pb-3">
				<span className="yr-mono text-[0.7rem] leading-normal tracking-[0.08em]">
					{t(print.formatKey)}
				</span>
				{/* The figure takes the display face. Its unit is mono, as all that a machine prints. */}
				<span className="flex items-baseline gap-1.5 whitespace-nowrap font-display font-extrabold text-[1.12rem] leading-tight tracking-[-0.02em]">
					{t(print.amountKey)}
					<span className="yr-mono font-normal text-[0.66rem] tracking-[0.1em]">
						{t("prints.currency")}
					</span>
				</span>
				<span className="yr-mono text-[0.62rem] text-background/70 uppercase leading-normal tracking-[0.1em]">
					{t(print.editionKey)}
				</span>
			</div>
		</article>
	);
}
