// One stop of the first visit: a white sticker with a coral number badge, an icon tile, a title, and a text.
// VisitSection renders four. From 1024px each card sits at its own place on the dotted path (placeClass).
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { VisitStep } from "../lib/content";
import { DISPLAY } from "../lib/styles";
import { StepIcon } from "./step-icon";

type StepCardProps = {
	step: VisitStep;
	/** The step number shown in the coral badge, from 1. */
	number: number;
	/** Classes for the place and the tilt of the card, from the layout of VisitSection. */
	placeClass: string;
	/** The fill and tilt classes of the icon tile. */
	iconClass: string;
};

/** A card of about 31% of the stage width on desktop, the full column on a phone. */
export function StepCard({
	step,
	number,
	placeClass,
	iconClass,
}: StepCardProps) {
	const { t } = useT();
	return (
		<li
			data-pop="self"
			className={cn(
				"gd-sticker gd-tilt relative rounded-[calc(var(--radius)*1.5)] px-5.5 pt-8.5 pb-5 text-foreground",
				placeClass,
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					DISPLAY,
					"gd-outline gd-shadow-3 absolute -start-4 -top-5.5 flex size-13 -rotate-8 items-center justify-center rounded-full bg-primary text-[1.35rem] text-primary-foreground",
				)}
			>
				{number}
			</span>
			<span
				aria-hidden="true"
				className={cn(
					"gd-outline gd-shadow-3 absolute -end-3 -top-5 flex size-13.5 items-center justify-center rounded-[calc(var(--radius)*1.0625)] max-lg:end-2.5",
					iconClass,
				)}
			>
				<StepIcon kind={step.icon} className="size-8.5" />
			</span>
			<h3 className={cn(DISPLAY, "mb-1.5 text-[1.35rem] leading-[1.05]")}>
				{t(step.titleKey)}
			</h3>
			<p className="font-bold text-[0.95rem] text-foreground/72 leading-relaxed">
				{t(step.bodyKey)}
			</p>
		</li>
	);
}
