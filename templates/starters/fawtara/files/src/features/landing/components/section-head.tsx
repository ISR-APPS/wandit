// The head of a section: the label pill, the title, and one optional sentence.
// The product, path, compare, pricing, and FAQ sections render it.
import { cn } from "~/shared/lib/utils";
import { LEAD, SECTION_TITLE } from "../lib/class-names";
import { LabelPill } from "./label-pill";

type SectionHeadProps = {
	/** The text of the label pill. */
	label: string;
	/** The h2 of the section. */
	title: string;
	/** One sentence under the title. */
	lead?: string;
	/** "center" puts the head in the middle of the page. The default is the start side. */
	align?: "start" | "center";
};

/** 640px wide at most. The title and the sentence have their own reveal. The sentence starts 90 ms later. */
export function SectionHead({
	label,
	title,
	lead,
	align = "start",
}: SectionHeadProps) {
	return (
		<div
			className={cn(
				"max-w-[640px]",
				align === "center" && "mx-auto text-center",
			)}
		>
			<LabelPill>{label}</LabelPill>
			<h2 data-reveal className={cn(SECTION_TITLE, "mt-5")}>
				{title}
			</h2>
			{lead === undefined ? null : (
				<p data-reveal className={cn(LEAD, "mt-4 [--fw-delay:90ms]")}>
					{lead}
				</p>
			)}
		</div>
	);
}
