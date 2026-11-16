// The title column of a section: the label, the title, one paragraph, an optional block, and a signature.
// The practitioners and the oath sections render it beside their list.
// From 768px to 899px it is a two-column head, so the band is never half empty.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import { LABEL, SECTION_TITLE } from "../lib/type-styles";
import { SectionLabel } from "./section-label";

type TitleColumnProps = {
	/** The ground of the section. The label and the hairlines follow it. */
	tone: "ground" | "quiet";
	label: string;
	title: string;
	/** The id of the h2. The section names itself with it through aria-labelledby. */
	titleId: string;
	body: string;
	/** The first line of the signature under the column, in muted ink. */
	signLine: string;
	/** The second line of the signature, in deep teal. */
	signNote: string;
	className?: string;
	/** Extra content between the paragraph and the signature: the roster list or a photo plate. */
	children?: ReactNode;
};

// The tablet layout: the title in the first column, the paragraph in the second.
const TABLET_HEAD =
	"md:max-[56.24rem]:grid md:max-[56.24rem]:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] md:max-[56.24rem]:items-start md:max-[56.24rem]:gap-x-[clamp(24px,4vw,48px)]";

/** A narrow column of text. The signature at its foot names who stands behind the section. */
export function TitleColumn({
	tone,
	label,
	title,
	titleId,
	body,
	signLine,
	signNote,
	className,
	children,
}: TitleColumnProps) {
	const hairline = tone === "quiet" ? "border-foreground/12" : "border-border";
	return (
		<div className={cn(TABLET_HEAD, className)}>
			<SectionLabel tone={tone} className="md:max-[56.24rem]:col-span-full">
				{label}
			</SectionLabel>
			<h2
				id={titleId}
				className={cn(
					SECTION_TITLE,
					"mb-4.5 max-w-[22ch] md:max-[56.24rem]:mb-0 min-[56.25rem]:max-w-[16ch]",
				)}
			>
				{title}
			</h2>
			<p className="max-w-[44ch] text-[0.9375rem] text-muted-foreground leading-[1.7] min-[56.25rem]:max-w-[34ch]">
				{body}
			</p>
			{children === undefined ? null : (
				<div className="md:max-[56.24rem]:col-span-full">{children}</div>
			)}
			<p
				className={cn(
					LABEL,
					"mt-[clamp(26px,3vw,38px)] border-t pt-4 text-muted-foreground leading-[1.9] tracking-[0.13em] md:max-[56.24rem]:col-span-full",
					hairline,
				)}
			>
				{signLine}
				<span className="block text-(--sp-teal-deep)">{signNote}</span>
			</p>
		</div>
	);
}
