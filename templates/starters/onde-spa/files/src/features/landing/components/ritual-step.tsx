// One step of the vertical ritual rail: a numbered circle with its sage ring, a title, a sentence, and a meta line.
// RitualSection renders three of them. landing.css dims the step and its ring from the scrub variables.
import { cn } from "~/shared/lib/utils";
import { ITEM_TITLE, META } from "../lib/styles";

type RitualStepProps = {
	/** Position in the ritual, 1 to 3. landing.css reads it to pick the scrub variable of this step. */
	position: 1 | 2 | 3;
	/** Translated stage name, for example "the steam". */
	title: string;
	/** Translated sentence that says what happens in the stage. */
	body: string;
	/** Translated duration and material line, for example "40 min · Kristel marble". */
	meta: string;
};

/** An <li>. The circle has the ground fill, so the rail hairline passes behind it and stays hidden there. */
export function RitualStep({ position, title, body, meta }: RitualStepProps) {
	return (
		<li
			data-step={position}
			className="onde-step grid grid-cols-[48px_minmax(0,1fr)] items-start gap-[clamp(0.9rem,1.4vw,1.3rem)]"
		>
			<span
				aria-hidden="true"
				className="relative grid size-12 place-items-center rounded-full border border-(--onde-hair-strong) bg-(--onde-ground-b) font-display text-[0.92rem] tabular-nums tracking-[0.02em]"
			>
				{`0${position}`}
				<span className="onde-step-ring absolute -inset-[5px] rounded-full border border-(--onde-sage)" />
			</span>
			<div>
				<h3 className={cn(ITEM_TITLE, "mt-[0.35rem]")}>{title}</h3>
				<p className="mt-[0.4rem] max-w-[34ch] text-(--onde-ink-72) text-[0.94rem] leading-[1.65]">
					{body}
				</p>
				<span className={cn(META, "mt-[0.45rem] block text-[0.74rem]")}>
					{meta}
				</span>
			</div>
		</li>
	);
}
