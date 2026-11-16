// Gift cards: a two-column head, three card plates stepped down as a staircase, and one ghost action.
// LandingPage renders it after the house. The action leads to the booking section, where the telephone is.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BODY_TEXT,
	GHOST_BUTTON,
	LABEL,
	SECTION_TITLE,
	SECTION_Y,
	WRAP,
} from "../lib/styles";
import { GiftCard } from "./gift-card";
import { SteamVeil } from "./steam-veil";

/** The <section id="gifts"> that the header link "gift cards" opens. */
export function GiftCardsSection() {
	const { t } = useT();
	return (
		<section
			id="gifts"
			aria-labelledby="gifts-title"
			className={cn("relative bg-(--onde-ground-b)", SECTION_Y)}
		>
			<SteamVeil kind="seam" phase={4} />
			<div className={cn(WRAP, "relative z-3")}>
				<div
					data-reveal=""
					className="grid grid-cols-1 items-end gap-[1.1rem] md:grid-cols-2 md:gap-[clamp(1.4rem,3vw,3.4rem)]"
				>
					<div>
						<p className={LABEL}>{t("gifts.label")}</p>
						<h2
							id="gifts-title"
							className={cn(SECTION_TITLE, "mt-4 max-w-[12ch]")}
						>
							{t("gifts.title")}
						</h2>
					</div>
					<p className={cn(BODY_TEXT, "max-w-[44ch] md:pb-2")}>
						{t("gifts.intro")}
					</p>
				</div>
				{/* The tide staircase: each card starts lower than the one before. */}
				<div className="mt-[clamp(2.4rem,5.5vh,3.8rem)] grid grid-cols-1 gap-[clamp(1.1rem,2vw,1.8rem)] md:grid-cols-3 md:items-start">
					<GiftCard
						label={t("gifts.card1Label")}
						title={t("gifts.card1Title")}
						body={t("gifts.card1Body")}
						price={t("gifts.card1Price")}
						duration={t("gifts.card1Duration")}
					/>
					<GiftCard
						label={t("gifts.card2Label")}
						title={t("gifts.card2Title")}
						body={t("gifts.card2Body")}
						price={t("gifts.card2Price")}
						duration={t("gifts.card2Duration")}
						className="md:mt-[clamp(1rem,3.4vh,2.6rem)]"
					/>
					<GiftCard
						label={t("gifts.card3Label")}
						title={t("gifts.card3Title")}
						body={t("gifts.card3Body")}
						price={t("gifts.card3Price")}
						duration={t("gifts.card3Duration")}
						className="md:mt-[clamp(2rem,6.8vh,5.2rem)]"
					/>
				</div>
				<div
					data-reveal=""
					className="mt-[clamp(2rem,4.4vh,3rem)] flex flex-wrap items-center justify-between gap-[1.2rem]"
				>
					<p className="max-w-[44ch] text-(--onde-ink-66) text-[0.83rem]">
						{t("gifts.foot")}
					</p>
					<a href="#book" className={GHOST_BUTTON}>
						{t("gifts.cta")}
					</a>
				</div>
			</div>
		</section>
	);
}
