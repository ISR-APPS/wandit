/**
 * The trophy teaser of the /pricing page. components/pricing.tsx renders it.
 * Six keycap tiles sit on one key plate, with a link to /trophies. It renders TrophyMedallion
 * from the trophies feature with fixed sample states, so it needs no query and works signed out.
 */
import { Link } from "@tanstack/react-router";
import { TROPHIES, type TrophyId } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { type ComponentProps, useId } from "react";

import { TrophyMedallion } from "@/features/trophies";
import { useDictionary } from "@/lib/i18n";
import { SECTION_TITLE_CLASS } from "../lib/constants";
import { Reveal } from "./reveal";

type MedallionState = ComponentProps<typeof TrophyMedallion>["state"];

// Sample states for the page: four earned keys, one key on the way, and one secret key.
// The ring of the key on the way shows progress.
const TEASER_TROPHIES = [
	{ id: "first_publish", state: "unlocked", progressRatio: 1 },
	{ id: "own_domain", state: "unlocked", progressRatio: 1 },
	{ id: "builds_500", state: "unlocked", progressRatio: 1 },
	{ id: "steady_4", state: "locked", progressRatio: 0.75 },
	{ id: "polyglot", state: "hidden", progressRatio: 0 },
	{ id: "spend_legend", state: "unlocked", progressRatio: 1 },
] as const satisfies readonly {
	id: TrophyId;
	state: MedallionState;
	/** Sample progress from 0 to 1. Only the locked key shows it. */
	progressRatio: number;
}[];

type TeaserTrophyId = (typeof TEASER_TROPHIES)[number]["id"];

/** The teaser section: the title, the key plate, and the link to the trophies page. */
export function PricingTrophyTeaser() {
	const dictionary = useDictionary();
	const copy = dictionary.landing.pricing.trophies;
	const trophyCopy = dictionary.trophies;
	const titleId = useId();
	const names = {
		first_publish: trophyCopy.items.first_publish.name,
		own_domain: trophyCopy.items.own_domain.name,
		builds_500: trophyCopy.items.builds_500.name,
		steady_4: trophyCopy.items.steady_4.name,
		// The secret trophy keeps its name secret here too.
		polyglot: trophyCopy.page.hiddenName,
		// The Fuel trophies keep the names of the spend badges in the credits dictionary.
		spend_legend: dictionary.credits.spendBadges.items.legend.name,
	} satisfies Record<TeaserTrophyId, string>;

	return (
		<section
			aria-labelledby={titleId}
			className="mx-2 rounded-[2rem] bg-cream/45 px-4 py-20 md:mx-3 md:rounded-[2.75rem] md:px-8 md:py-28"
		>
			<div className="mx-auto flex max-w-5xl flex-col items-center text-center">
				<p className="font-semibold text-ember-deep text-sm uppercase tracking-[0.16em] rtl:tracking-normal">
					{copy.kicker}
				</p>
				<h2 id={titleId} className={cn(SECTION_TITLE_CLASS, "mt-4")}>
					{copy.title}
				</h2>
				<p className="mt-5 max-w-[46ch] text-balance text-lg text-night/65 leading-relaxed">
					{copy.sub}
				</p>

				<Reveal className="mt-12 w-full md:mt-14">
					{/* The key plate: a pressed tray that holds the keys, like the deck of a keyboard. */}
					<ul className="grid grid-cols-3 gap-x-3 gap-y-7 rounded-[1.75rem] bg-white/70 px-4 pt-7 pb-6 shadow-[inset_0_2px_6px_rgb(11_16_51/0.08)] ring-1 ring-night/[0.06] sm:grid-cols-6 md:rounded-[2rem] md:px-8 md:pt-9 md:pb-8">
						{TEASER_TROPHIES.map((trophy) => {
							const rarity = TROPHIES.find(
								(definition) => definition.id === trophy.id,
							)?.rarity;
							return (
								<li
									key={trophy.id}
									className="flex min-w-0 flex-col items-center gap-3"
								>
									<TrophyMedallion
										trophyId={trophy.id}
										state={trophy.state}
										progressRatio={trophy.progressRatio}
										size="lg"
										// The /pricing page is light only, but a stored dark theme puts `.dark` on <html>.
										lightOnly
									/>
									<span className="min-w-0">
										<span className="block text-balance font-semibold text-sm leading-tight">
											{names[trophy.id]}
										</span>
										{/* A secret trophy also hides its rarity. */}
										{trophy.state !== "hidden" && rarity ? (
											<span className="mt-0.5 block text-night/55 text-xs">
												{trophyCopy.rarity[rarity]}
											</span>
										) : null}
									</span>
								</li>
							);
						})}
					</ul>
				</Reveal>

				<Link
					to="/trophies"
					className="group mt-10 inline-flex items-center gap-2 rounded-full px-1 font-semibold text-base text-night underline decoration-night/25 underline-offset-4 outline-offset-4 transition-colors hover:decoration-ember focus-visible:outline-2 focus-visible:outline-ember"
				>
					{copy.link}
					<ArrowRightIcon
						aria-hidden
						strokeWidth={2.25}
						className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
					/>
				</Link>
			</div>
		</section>
	);
}
