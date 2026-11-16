// Round 7, "Book Your First Round": the sample contact details, the cut-man's checklist, and the booking ticket.
// landing-page.tsx renders it and owns the chosen program.
import { useT } from "~/shared/i18n";
import { type BoutChoice, CONTACT } from "../lib/content";
import { BookingTicket } from "./booking-ticket";
import { Reveal } from "./reveal";
import { RoundHeader } from "./round-header";
import { Star } from "./star";

type BookSectionProps = {
	/** The program on the ticket, or "unsure". */
	choice: BoutChoice;
	/** Changes the program on the ticket. */
	onChoose: (choice: BoutChoice) => void;
};

/** The contact section. The phone number, the email address, and the street are fictional sample details. */
export function BookSection({ choice, onChoose }: BookSectionProps) {
	const { t } = useT();
	const checklist = [t("book.cutman1"), t("book.cutman2"), t("book.cutman3")];
	return (
		<section
			id="book"
			aria-labelledby="book-title"
			className="sp-gutter py-14 md:py-20"
		>
			<div className="mx-auto max-w-7xl">
				<RoundHeader
					round={7}
					layout="start"
					titleId="book-title"
					kickerStart={t("book.kicker")}
					titleStart={t("book.titleStart")}
					titleAccent={t("book.titleAccent")}
				/>
				{/* minmax(0, …) lets a track shrink below its longest word, so the ticket never sets the page width. */}
				<div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-[clamp(1.8rem,4vw,4rem)] gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
					<Reveal>
						<p className="max-w-[46ch] text-muted-foreground md:text-lg">
							{t("book.intro1")}
						</p>
						<p className="mt-5 max-w-[46ch] text-muted-foreground md:text-lg">
							{t("book.intro2")}
						</p>
						<dl className="mt-7">
							<div className="sp-line flex items-center gap-4 border-b border-dashed py-3">
								<dt className="sp-faint min-w-24 font-bold text-[0.64rem] uppercase tracking-[0.26em]">
									{t("book.ringUs")}
								</dt>
								<dd>
									<a
										href={CONTACT.phoneHref}
										className="sp-foot-link -my-1.5 inline-block py-1.5"
									>
										{t("book.phone")}
									</a>
								</dd>
							</div>
							<div className="sp-line flex items-center gap-4 border-b border-dashed py-3">
								<dt className="sp-faint min-w-24 font-bold text-[0.64rem] uppercase tracking-[0.26em]">
									{t("book.writeUs")}
								</dt>
								<dd className="min-w-0 break-words">
									<a
										href={`mailto:${CONTACT.emailAddress}`}
										className="sp-foot-link -my-1.5 inline-block py-1.5"
									>
										{t("book.email")}
									</a>
								</dd>
							</div>
							<div className="sp-line flex items-center gap-4 border-b border-dashed py-3">
								<dt className="sp-faint min-w-24 font-bold text-[0.64rem] uppercase tracking-[0.26em]">
									{t("book.findUs")}
								</dt>
								<dd>{t("book.address")}</dd>
							</div>
							<div className="sp-line flex items-center gap-4 border-b border-dashed py-3">
								<dt className="sp-faint min-w-24 font-bold text-[0.64rem] uppercase tracking-[0.26em]">
									{t("book.doors")}
								</dt>
								<dd>{t("book.hours")}</dd>
							</div>
						</dl>
						<div className="sp-cutman relative mt-9 px-6 pt-6 pb-5">
							<p className="sp-gold absolute start-4 -top-3.5 bg-background px-2.5 font-display font-extrabold text-xl uppercase leading-tight tracking-[0.12em]">
								{t("book.cutmanHead")}
							</p>
							<ul>
								{checklist.map((item) => (
									<li
										key={item}
										className="sp-line flex gap-3 border-b border-dashed py-2 text-[0.92rem] text-muted-foreground"
									>
										<Star className="mt-1 text-primary text-sm" />
										{item}
									</li>
								))}
								<li className="flex gap-3 py-2 text-[0.92rem] text-muted-foreground">
									<Star className="mt-1 text-primary text-sm" />
									<span>
										<s className="sp-struck">{t("book.cutman4Struck")}</s>{" "}
										{t("book.cutman4Rest")}
									</span>
								</li>
							</ul>
						</div>
					</Reveal>
					<Reveal delayMs={90}>
						<BookingTicket choice={choice} onChoose={onChoose} />
					</Reveal>
				</div>
			</div>
		</section>
	);
}
