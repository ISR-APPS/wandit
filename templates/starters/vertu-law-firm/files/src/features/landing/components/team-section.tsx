// "The team", the first cream interlude: one brass door plate per partner over a factual paragraph,
// then a hairline ledger of the associates. LandingPage renders it. No portrait: the plates are the people.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { ASSOCIATES, PARTNERS } from "../lib/content";
import { enterDelay } from "../lib/motion";
import { LABEL } from "../lib/type-styles";
import { Nameplate } from "./nameplate";
import { SectionHead } from "./section-head";

/** Four door plates in a row on a wide screen, two on a tablet, one on a phone. */
export function TeamSection() {
	const { t } = useT();
	return (
		<section
			id="team"
			aria-labelledby="team-title"
			className="vt-cream vt-section"
		>
			<div className="vt-wrap">
				<SectionHead tab="team.tab" note="team.note" />
				<h2 id="team-title" className="sr-only">
					{t("team.title")}
				</h2>
				<ul className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
					{PARTNERS.map((partner, index) => (
						<li
							key={partner.name}
							data-reveal="end"
							className="flex flex-col gap-4"
							// The plates go up one by one, 90 ms apart, like doors along a corridor.
							style={enterDelay(index * 90)}
						>
							<Nameplate name={t(partner.name)} sub={t(partner.role)} />
							<p className="pe-2 text-(--vt-ink-70) text-[0.93rem] leading-[1.55]">
								{t(partner.bio)}
							</p>
						</li>
					))}
				</ul>

				<div
					data-reveal
					className="vt-line mt-[clamp(2.8rem,5vw,4rem)] border-t"
				>
					<div
						aria-hidden="true"
						className="vt-line grid grid-cols-[1fr_auto] gap-x-4 border-b py-3 sm:grid-cols-[1.4fr_1.6fr_0.8fr]"
					>
						<span className={cn(LABEL, "text-(--vt-brass) text-[10.5px]")}>
							{t("team.ledgerName")}
						</span>
						<span
							className={cn(
								LABEL,
								"hidden text-(--vt-brass) text-[10.5px] sm:block",
							)}
						>
							{t("team.ledgerRole")}
						</span>
						<span
							className={cn(LABEL, "text-end text-(--vt-brass) text-[10.5px]")}
						>
							{t("team.ledgerLanguages")}
						</span>
					</div>
					<ul>
						{ASSOCIATES.map((associate) => (
							<li
								key={associate.name}
								className="vt-faint grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b py-3 sm:grid-cols-[1.4fr_1.6fr_0.8fr]"
							>
								<span className="font-display text-[1.06rem]">
									{t(associate.name)}
								</span>
								<span className="col-start-1 row-start-2 text-(--vt-ink-50) text-[0.88rem] sm:col-start-auto sm:row-start-auto sm:text-(--vt-ink-70) sm:text-[0.93rem]">
									{t(associate.role)}
								</span>
								<span
									className={cn(
										LABEL,
										"col-start-2 row-start-1 text-end font-normal text-(--vt-ink-50) text-[11px] tracking-[0.08em] sm:col-start-auto sm:row-start-auto",
									)}
								>
									{t(associate.languages)}
								</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
