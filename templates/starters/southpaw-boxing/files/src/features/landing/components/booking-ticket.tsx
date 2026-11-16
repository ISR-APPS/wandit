// The booking ticket of round 7: pick a program, read the card, then ring the bell (an email link) or call.
// book-section.tsx renders it. landing-page.tsx owns the choice, so the fight card can set it too.
// It sends nothing to a server. STARTER.md says where a real booking form goes.
import { useT } from "~/shared/i18n";
import { BOUTS, type BoutChoice, CONTACT } from "../lib/content";
import { BellVisual } from "./bell-visual";
import { Star } from "./star";

type BookingTicketProps = {
	/** The program on the ticket, or "unsure" when a coach picks the first class. */
	choice: BoutChoice;
	/** Changes the program on the ticket. */
	onChoose: (choice: BoutChoice) => void;
};

/** The ticket shows the chosen bout and puts its name in the subject of the email link. */
export function BookingTicket({ choice, onChoose }: BookingTicketProps) {
	const { t } = useT();
	const isUnsure = choice === "unsure";
	const name = isUnsure ? t("book.unsureName") : t(`card.${choice}.name`);
	const foe = isUnsure ? t("book.unsureFoe") : t(`card.${choice}.foe`);
	const meta = isUnsure ? t("book.unsureMeta") : t(`card.${choice}.meta`);
	const price = isUnsure ? t("book.unsurePrice") : t(`card.${choice}.price`);
	const subject = encodeURIComponent(`${t("book.mailSubject")} — ${name}`);
	const options: readonly { id: BoutChoice; label: string }[] = [
		...BOUTS.map((bout) => ({ id: bout.id, label: t(`card.${bout.id}.name`) })),
		{ id: "unsure", label: t("book.pickUnsure") },
	];

	return (
		<div className="sp-frame sp-surface sp-halftone">
			<div className="p-[clamp(1.4rem,3vw,2.25rem)] pb-6">
				<div className="sp-line-strong mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 pb-3.5">
					<p className="font-display font-extrabold text-[1.75rem] uppercase leading-none tracking-[0.08em]">
						<Star className="me-2.5 text-[0.7em] text-primary" />
						{t("book.ticketHead")}
					</p>
					<p className="sp-faint font-bold text-[0.62rem] uppercase tracking-[0.26em]">
						{t("book.ticketSerial")}
					</p>
				</div>

				<p
					id="pick-label"
					className="mb-3 font-bold text-[0.66rem] text-muted-foreground uppercase tracking-[0.26em]"
				>
					{t("book.pickLabel")}
				</p>
				{/* biome-ignore lint/a11y/useSemanticElements: a fieldset cannot lay out its chips with flex wrap in every browser */}
				<div
					role="group"
					aria-labelledby="pick-label"
					className="flex flex-wrap gap-2.5"
				>
					{options.map((option) => (
						<button
							key={option.id}
							type="button"
							aria-pressed={choice === option.id}
							onClick={() => onChoose(option.id)}
							className="sp-chip cursor-pointer px-3.5 pt-2.5 pb-2 font-display font-extrabold text-lg uppercase leading-none tracking-[0.06em]"
						>
							{option.label}
						</button>
					))}
				</div>

				<div
					aria-live="polite"
					className="sp-ticket-card mt-6 flex items-center gap-4 p-4 sm:gap-5 sm:p-5 md:gap-6 md:p-6"
				>
					<BellVisual key={choice} label={t("book.bellAlt")} />
					<div className="min-w-0">
						<p className="sp-faint font-bold text-[0.62rem] uppercase tracking-[0.3em]">
							{t("book.yourCard")}
						</p>
						<p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 font-display font-extrabold uppercase leading-none">
							<span className="text-[clamp(1.75rem,3vw,2.4rem)]">{name}</span>
							<span className="sp-hot text-lg lowercase tracking-[0.1em]">
								{t("card.versus")}
							</span>
							<span className="text-[clamp(1.2rem,2vw,1.6rem)] text-muted-foreground">
								{foe}
							</span>
						</p>
						<p className="sp-faint mt-2.5 text-balance font-bold text-[0.64rem] uppercase leading-relaxed tracking-[0.2em]">
							{meta}
							{/* The price takes its own line at each width, so no line starts or ends with a dash. */}
							<span className="sp-gold block">{price}</span>
						</p>
					</div>
				</div>
			</div>

			<div className="sp-perf flex flex-wrap items-center gap-x-6 gap-y-4 px-[clamp(1.4rem,3vw,2.25rem)] py-6">
				<a
					href={`mailto:${CONTACT.emailAddress}?subject=${subject}`}
					className="sp-btn sp-btn-primary inline-block px-7 pt-3.5 pb-3 font-display font-extrabold text-xl uppercase leading-tight tracking-[0.07em]"
				>
					{t("book.ticketCta")}
				</a>
				<p className="text-sm">
					<span className="text-muted-foreground">{t("book.ticketCall")}</span>{" "}
					<a
						href={CONTACT.phoneHref}
						className="sp-foot-link -my-1.5 inline-block py-1.5 font-semibold"
					>
						{t("book.phone")}
					</a>
				</p>
				<p className="sp-faint w-full text-xs leading-relaxed tracking-[0.04em]">
					{t("book.ticketNote")}
				</p>
			</div>
		</div>
	);
}
