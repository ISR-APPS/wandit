// One member of the team: the tilted drawn portrait, the name in a white pill, the role in teal capitals, a fun fact.
// TeamSection renders four. On hover or focus the portrait turns straight, lifts, and grows.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { TeamMember } from "../lib/content";
import { DISPLAY } from "../lib/styles";
import { MemberPortrait } from "./member-portrait";

type TeamMemberCardProps = {
	member: TeamMember;
	/** The tilt class of the portrait, for example [--gd-r:-2deg]. */
	tiltClass: string;
	/** The tilt class of the name pill: left on odd cards, right on even ones. */
	nameTiltClass: string;
};

/** A centered figure. The portrait is at most 210px wide. */
export function TeamMemberCard({
	member,
	tiltClass,
	nameTiltClass,
}: TeamMemberCardProps) {
	const { t } = useT();
	return (
		<figure className="group relative text-center">
			<div
				className={cn(
					"gd-tilt mx-auto w-[min(210px,88%)] transition-[rotate,translate,scale] duration-300 ease-(--gd-pop) group-hover:translate-y-[-6px] group-hover:rotate-0 group-hover:scale-105 max-sm:w-full",
					tiltClass,
				)}
			>
				<MemberPortrait kind={member.portrait} label={t(member.altKey)} />
			</div>
			<figcaption>
				<h3
					className={cn(
						DISPLAY,
						"gd-outline-thin gd-shadow-3 mt-4.5 inline-block rounded-full bg-card px-[1em] py-[0.35em] text-[1.2rem] leading-tight max-sm:text-[1rem]",
						nameTiltClass,
					)}
				>
					{t(member.nameKey)}
				</h3>
				<span className="mt-2.5 block font-bold font-display text-(--gd-teal) text-[0.92rem] uppercase tracking-[0.06em] max-sm:text-[0.76rem] max-sm:tracking-[0.03em]">
					{t(member.roleKey)}
				</span>
				<p className="mx-auto mt-1.5 max-w-[24ch] font-bold text-[0.95rem] text-foreground/72 leading-snug max-sm:text-[0.86rem]">
					{t(member.factKey)}
				</p>
			</figcaption>
		</figure>
	);
}
