// The title line of one project: a large stone numeral and the serif name on one baseline.
// ProjectPortrait and ProjectBand render it.
import { cn } from "~/shared/lib/utils";
import { NUMERAL, SERIF_NAME } from "../lib/type-styles";

type ProjectTitleProps = {
	/** Two digits, for example "01". The order is the order of the page. */
	digits: string;
	/** Name of the project. It is a proper name, so the caller passes it translated. */
	name: string;
};

/** Numeral and name of a project. The name is the h3 of its article. */
export function ProjectTitle({ digits, name }: ProjectTitleProps) {
	return (
		<div className="mb-3 flex items-baseline gap-3.5">
			<span
				aria-hidden="true"
				className={cn(NUMERAL, "text-[clamp(1.7rem,3vw,2.6rem)]")}
			>
				{digits}
			</span>
			<h3 className={SERIF_NAME}>{name}</h3>
		</div>
	);
}
