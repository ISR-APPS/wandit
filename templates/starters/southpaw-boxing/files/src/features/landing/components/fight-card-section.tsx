// Round 2, "Tonight's Fight Card": the four programs as bouts on an official card.
// landing-page.tsx renders it and owns the claimed program. It reads BOUTS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { BOUTS, type BoutChoice, type BoutId } from "../lib/content";
import { BoutRow } from "./bout-row";
import { CardSeal } from "./card-seal";
import { Reveal } from "./reveal";
import { RoundHeader } from "./round-header";
import { Star } from "./star";

type FightCardSectionProps = {
	/** The program on the booking ticket, or "unsure" when a coach picks. Its row stays ignited. */
	choice: BoutChoice;
	/** Puts a program on the booking ticket. */
	onClaim: (id: BoutId) => void;
};

/** The signature section of the page: a double-framed card with a torn-ticket foot. */
export function FightCardSection({ choice, onClaim }: FightCardSectionProps) {
	const { t } = useT();
	return (
		<section
			id="card"
			aria-labelledby="card-title"
			className="sp-gutter bg-linear-to-b from-canvas to-background py-14 md:py-20"
		>
			<div className="mx-auto max-w-7xl">
				<RoundHeader
					round={2}
					layout="center"
					titleId="card-title"
					kickerStart={t("card.kickerStart")}
					kickerEnd={t("card.kickerEnd")}
					titleStart={t("card.titleStart")}
					titleAccent={t("card.titleAccent")}
					sub={t("card.sub")}
				/>

				<div className="sp-frame sp-surface">
					<Reveal className="sp-line-strong relative border-b-2 px-4 pt-6 pb-5 text-center sm:px-24">
						<CardSeal className="sp-grit absolute start-6 top-1/2 hidden size-16 -translate-y-1/2 -rotate-8 text-primary opacity-60 sm:block" />
						<p className="whitespace-nowrap font-display font-extrabold text-[clamp(1.5rem,3.6vw,2.6rem)] uppercase leading-none tracking-[0.06em] sm:tracking-[0.12em]">
							<Star className="me-2 text-[0.6em] text-primary sm:me-3" />
							{t("card.headTitle")}
							<Star className="ms-2 text-[0.6em] text-primary sm:ms-3" />
						</p>
						<p className="sp-faint mt-2.5 text-balance font-bold text-[0.64rem] uppercase leading-relaxed tracking-[0.3em]">
							{t("card.headSanction")}
						</p>
						<CardSeal className="sp-grit absolute end-6 top-1/2 hidden size-16 -translate-y-1/2 rotate-9 text-primary opacity-60 sm:block" />
					</Reveal>

					{BOUTS.map((bout, index) => (
						<BoutRow
							key={bout.id}
							bout={bout}
							round={index + 1}
							isClaimed={choice === bout.id}
							onClaim={onClaim}
						/>
					))}

					<p className="sp-perf sp-faint px-4 py-4 text-center font-semibold text-[0.64rem] uppercase leading-loose tracking-[0.26em]">
						<span className="block sm:inline">{t("card.foot1")}</span>
						<Star className="sp-sep hidden text-primary sm:inline-block" />
						<span className="block sm:inline">{t("card.foot2")}</span>
						<Star className="sp-sep hidden text-primary sm:inline-block" />
						<span className="block sm:inline">{t("card.foot3")}</span>
					</p>
				</div>
			</div>
		</section>
	);
}
