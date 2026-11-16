// One folder of the practice drawer: a numbered tab on the top edge, the area name, the lead partner, and a pull chevron.
// PracticesSection renders five of them. Each folder is an anchor to its panel, so it works with no script.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { PracticeId } from "../lib/content";
import { fanStyle } from "../lib/motion";
import { LABEL } from "../lib/type-styles";

type PracticeFolderProps = {
	id: PracticeId;
	/** The place of the folder in the drawer, from 0. It sets the number and the fan offset of the tab. */
	index: number;
	/** The opening of the drawer, from 0 (tabs in one stack) to 1 (tabs fanned out). From useFanProgress. */
	fan: number;
	/** True for the folder of the panel in reading position. It takes the brass tab and slides forward. */
	isCurrent: boolean;
};

/** A folder link. landing.css draws the card stock, the current state, and the 34px slide from 1024px. */
export function PracticeFolder({
	id,
	index,
	fan,
	isCurrent,
}: PracticeFolderProps) {
	const { t } = useT();
	return (
		<a
			href={`#practice-${id}`}
			aria-current={isCurrent ? "true" : undefined}
			className="vt-folder"
			style={fanStyle(index, fan)}
		>
			<span className="vt-tab vt-ftab">
				<span className={cn(LABEL, "text-[10.5px] tabular-nums")}>
					{String(index + 1).padStart(2, "0")}
				</span>
			</span>
			<span className="block px-5 pe-12 pt-2.5 font-display text-[clamp(1.08rem,1.45vw,1.35rem)] leading-[1.24] lg:pt-3.5">
				{t(`practices.${id}.name`)}
			</span>
			{/* Below lg the hero rail already names the areas, so the folder drops its meta line to stay compact. */}
			<span className="block px-5 pe-12 pt-2 text-(--vt-ink-50) text-xs tracking-[0.04em] max-lg:hidden">
				{t(`practices.${id}.meta`)}
			</span>
			<span aria-hidden="true" className="vt-chevron" />
		</a>
	);
}
