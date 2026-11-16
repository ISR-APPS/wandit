// The team: a head with a "Say cheese!" stamp and a drawn arrow, then four drawn portraits.
// LandingPage renders it after the stats row. The members come from TEAM in lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { TEAM } from "../lib/content";
import { DISPLAY, SECTION_LEDE, SECTION_TITLE, TAG, WRAP } from "../lib/styles";
import { TeamMemberCard } from "./team-member-card";

/** The tilt of each portrait and of its name pill, in grid order. */
const MEMBER_TILTS = [
	{ tiltClass: "[--gd-r:-2deg]", nameTiltClass: "-rotate-[1.5deg]" },
	{ tiltClass: "[--gd-r:1.6deg]", nameTiltClass: "rotate-[1.5deg]" },
	{ tiltClass: "[--gd-r:-1.4deg]", nameTiltClass: "-rotate-[1.5deg]" },
	{ tiltClass: "[--gd-r:2deg]", nameTiltClass: "rotate-[1.5deg]" },
] as const;

/** Four columns from 1024px, two below. The stamp leaves under 820px. */
export function TeamSection() {
	const { t } = useT();
	return (
		<section
			id="team"
			aria-labelledby="team-title"
			className="relative scroll-mt-24 pt-[clamp(1.4rem,3vw,3rem)] pb-[clamp(4.5rem,7vw,6.5rem)]"
		>
			<div className={WRAP}>
				<div
					data-pop="self"
					className="mb-[clamp(2.6rem,4.5vw,3.8rem)] flex flex-wrap items-end justify-between gap-6"
				>
					<div className="max-w-[640px]">
						<p
							className={cn(
								TAG,
								"mb-4 -rotate-2 bg-primary text-primary-foreground",
							)}
						>
							{t("team.tag")}
						</p>
						<h2 id="team-title" className={cn(SECTION_TITLE, "mb-3")}>
							{t("team.title")}
						</h2>
						<p className={SECTION_LEDE}>{t("team.lede")}</p>
					</div>
					<div
						aria-hidden="true"
						className="flex flex-col items-center gap-1 pb-1 max-[820px]:hidden"
					>
						<span
							className={cn(
								DISPLAY,
								"gd-outline-thin gd-shadow-3 rotate-4 whitespace-nowrap rounded-full bg-(--gd-sun) px-[1.15em] py-[0.45em] text-[0.98rem]",
							)}
						>
							{t("team.stamp")}
						</span>
						<svg
							viewBox="0 0 80 92"
							aria-hidden="true"
							focusable="false"
							className="me-2.5 h-auto w-18 rotate-3"
						>
							<path
								d="M52 8 C 74 22 74 50 48 66 C 34 75 22 72 16 60"
								fill="none"
								strokeWidth="4"
								strokeLinecap="round"
								className="stroke-foreground"
							/>
							<path
								d="M8 48 L15 63 L31 55"
								fill="none"
								strokeWidth="4"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="stroke-foreground"
							/>
						</svg>
					</div>
				</div>
				<div
					data-pop="kids"
					className="grid grid-cols-2 gap-x-[clamp(1rem,2.5vw,2rem)] gap-y-11 lg:grid-cols-4"
				>
					{TEAM.map((member, index) => (
						<TeamMemberCard
							key={member.nameKey}
							member={member}
							tiltClass={MEMBER_TILTS[index]?.tiltClass ?? ""}
							nameTiltClass={MEMBER_TILTS[index]?.nameTiltClass ?? ""}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
