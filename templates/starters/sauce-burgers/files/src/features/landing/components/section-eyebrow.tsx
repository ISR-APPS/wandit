// The opening of a section: a small capital label over a short 4px rule.
// Each section head renders it above its title.
import { cn } from "~/shared/lib/utils";
import { LABEL_TEXT } from "../lib/type-styles";

/** The ground of the section. The rule takes the contrast color of that ground. */
type GroundTone = "cream" | "hot" | "mustard";

const RULE_CLASS_OF: Record<GroundTone, string> = {
	cream: "bg-primary",
	hot: "bg-(--sc-mustard)",
	mustard: "bg-foreground",
};

type SectionEyebrowProps = {
	/** The translated label, for example "The menu". */
	label: string;
	ground: GroundTone;
};

/** The rule is 190px wide at most, and never wider than its column. */
export function SectionEyebrow({ label, ground }: SectionEyebrowProps) {
	return (
		<>
			<p className={cn(LABEL_TEXT, "mb-2.5 tracking-[0.14em]")}>{label}</p>
			<div
				aria-hidden="true"
				className={cn(
					"mb-[clamp(18px,2.6vh,30px)] h-1 w-full max-w-[190px]",
					RULE_CLASS_OF[ground],
				)}
			/>
		</>
	);
}
