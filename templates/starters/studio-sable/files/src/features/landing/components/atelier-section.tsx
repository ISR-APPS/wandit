// Section 06, the workshop: a heading column with one client quote, and the ledger of the six people.
// LandingPage renders it. The texts are in the `atelier` message group.
import { useT } from "~/shared/i18n";
import {
	BAND,
	LEDGER_LABEL,
	MONO,
	PROSE,
	SECTION_MARK,
	SECTION_TITLE,
	WRAP,
} from "../lib/type-styles";
import { AccentDot } from "./accent-dot";
import { SectionHead } from "./section-head";
import { Wordmark } from "./wordmark";

// The six people in order of arrival. `number` picks the texts `atelier.person<number>Name` and `...Role`.
// `since` is the year a person joined, four digits. Not translated.
const PEOPLE = [
	{ number: 1, since: "2019" },
	{ number: 2, since: "2020" },
	{ number: 3, since: "2021" },
	{ number: 4, since: "2022" },
	{ number: 5, since: "2023" },
	{ number: 6, since: "2024" },
] as const;

/** The workshop split: 5 parts for the heading and the quote, 7 parts for the people. */
export function AtelierSection() {
	const { t } = useT();
	const people = PEOPLE.map((person) => ({
		name: t(`atelier.person${person.number}Name`),
		role: t(`atelier.person${person.number}Role`),
		since: person.since,
	}));
	return (
		<section
			id="workshop"
			aria-labelledby="workshop-title"
			data-cascade=""
			className={BAND}
		>
			<div className={WRAP}>
				<SectionHead label={t("atelier.label")} />
				{/* A phone reads the heading, the people, then the quote. From 1024px the quote goes under the heading,
				    and its foot is level with the last row of the people. */}
				<div className="grid items-start gap-x-[clamp(28px,5vw,90px)] gap-y-[clamp(24px,3.4vh,36px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
					<div>
						<p className={SECTION_MARK}>
							<Wordmark />
						</p>
						<h2 id="workshop-title" className={`${SECTION_TITLE} sable-fade`}>
							{t("atelier.title")}
							<AccentDot />
						</h2>
						<p className={`${PROSE} sable-fade mt-4 max-w-[40ch]`}>
							{t("atelier.text")}
						</p>
					</div>
					<ul className="border-foreground border-t lg:col-start-2 lg:row-span-2 lg:row-start-1">
						{people.map((person) => (
							<li
								key={person.name}
								className="sable-row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-foreground/14 border-b py-4 lg:py-[19px] min-[861px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_110px] min-[861px]:gap-5"
							>
								<span className="font-display font-medium text-[clamp(1.15rem,1.7vw,1.5rem)] leading-[1.1] tracking-[-0.025em]">
									{person.name}
								</span>
								<span
									className={`${MONO} order-3 text-foreground/80 min-[861px]:order-none`}
								>
									{person.role}
								</span>
								{/* translate() takes no parameters, so the word order of this line is fixed here on purpose. */}
								<span className={`${MONO} text-end text-foreground/55`}>
									{t("atelier.since")} {person.since}
								</span>
							</li>
						))}
					</ul>
					<blockquote className="sable-fade border-primary border-s ps-[clamp(18px,2.4vw,32px)] lg:col-start-1 lg:row-start-2 lg:self-end">
						<p className="max-w-[26ch] font-display font-medium text-[clamp(1.3rem,2.2vw,1.9rem)] leading-[1.2] tracking-[-0.03em]">
							{t("atelier.quote")}
							<AccentDot />
						</p>
						<footer className={`${LEDGER_LABEL} mt-3.5`}>
							{t("atelier.quoteSource")}
						</footer>
					</blockquote>
				</div>
			</div>
		</section>
	);
}
