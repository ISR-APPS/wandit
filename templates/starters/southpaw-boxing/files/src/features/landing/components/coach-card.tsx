// One coach of round 3: portrait, ring name, record plate, a "tale of the tape", and a quote.
// corner-section.tsx renders one for each id of COACH_IDS.
import { useT } from "~/shared/i18n";
import type { CoachId } from "../lib/content";
import { CoachPortrait } from "./coach-portrait";

/** A coach card. All its texts come from the group `corner.<coach>` of messages.ts. */
export function CoachCard({ coach }: { coach: CoachId }) {
	const { t } = useT();
	const tape = [
		{ label: t("corner.stance"), value: t(`corner.${coach}.stance`) },
		{ label: t("corner.reach"), value: t(`corner.${coach}.reach`) },
		{ label: t("corner.since"), value: t(`corner.${coach}.since`) },
		{ label: t("corner.specialty"), value: t(`corner.${coach}.specialty`) },
	];
	return (
		<div className="sp-coach flex h-full flex-col overflow-clip">
			<div className="h-1.5 bg-primary" />
			<div className="sp-coach-face mx-auto mt-8 size-30 overflow-hidden">
				<CoachPortrait coach={coach} />
			</div>
			<div className="flex flex-1 flex-col px-6 pt-5 pb-7 text-center md:px-7">
				<p className="sp-hot font-display font-extrabold text-xl uppercase leading-tight tracking-[0.14em]">
					{t(`corner.${coach}.nick`)}
				</p>
				<h3 className="mt-1 font-display font-extrabold text-[2.4rem] uppercase leading-none">
					{t(`corner.${coach}.name`)}
				</h3>
				<p className="sp-faint mt-2 font-bold text-[0.66rem] uppercase tracking-[0.26em]">
					{t(`corner.${coach}.role`)}
				</p>
				<p className="sp-coach-record mx-auto mt-5 mb-4 px-5 pt-2.5 pb-2 font-display font-extrabold text-3xl leading-none tracking-[0.06em]">
					{t(`corner.${coach}.record`)}
					<small className="sp-faint mt-1.5 block font-bold font-sans text-[0.56rem] uppercase tracking-[0.3em]">
						{t(`corner.${coach}.knockouts`)}
					</small>
				</p>
				<dl className="mb-5 text-start">
					{tape.map((row) => (
						<div
							key={row.label}
							className="sp-line flex items-center justify-between gap-4 border-b border-dashed py-2.5"
						>
							<dt className="sp-faint font-bold text-[0.64rem] uppercase tracking-[0.18em]">
								{row.label}
							</dt>
							<dd className="text-end font-semibold text-sm">{row.value}</dd>
						</div>
					))}
				</dl>
				<blockquote className="mt-auto text-[0.95rem] text-muted-foreground italic leading-relaxed">
					{t(`corner.${coach}.quote`)}
				</blockquote>
			</div>
		</div>
	);
}
