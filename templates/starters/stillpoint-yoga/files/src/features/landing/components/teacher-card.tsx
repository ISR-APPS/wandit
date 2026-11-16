// One teacher: a pose drawing on a sage pebble, the name, the practice in clay, and one line in italic serif.
// TeachersSection renders four of them in two offset columns. The card lifts on hover and the pebble changes shape.
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { type Pose, PoseFigure } from "./pose-figure";

type TeacherCardProps = {
	pose: Pose;
	nameKey: TranslationKey;
	/** Key of the role line, for example "Founder · Slow Flow". */
	roleKey: TranslationKey;
	/** Key of the one line that members say about the teacher. */
	lineKey: TranslationKey;
	/** Key of the alt text of the pose drawing. */
	artKey: TranslationKey;
};

/** A teacher card on the surface bone. No photo: the drawing stands for the teacher. */
export function TeacherCard({
	pose,
	nameKey,
	roleKey,
	lineKey,
	artKey,
}: TeacherCardProps) {
	const { t } = useT();
	return (
		<article
			data-reveal
			className="sp-teacher relative overflow-hidden rounded-2xl bg-(--sp-surface) p-[clamp(26px,3.4vw,44px)] md:even:top-[clamp(24px,4vw,64px)]"
		>
			<div className="relative mb-[26px] flex h-[216px] items-end justify-center">
				<div
					aria-hidden="true"
					className="sp-pebble absolute inset-x-0 bottom-1.5 mx-auto h-[82%] w-[78%]"
				/>
				<PoseFigure pose={pose} label={t(artKey)} />
			</div>
			<h3 className="font-display font-normal text-[1.65rem] leading-[1.1]">
				{t(nameKey)}
			</h3>
			<p className="mt-1.5 font-bold font-sans text-(--sp-terra-ink) text-[0.72rem] uppercase tracking-[0.22em]">
				{t(roleKey)}
			</p>
			<p className="mt-4 font-display text-(--sp-ink-78) text-[1.12rem] italic leading-[1.5]">
				{t(lineKey)}
			</p>
		</article>
	);
}
