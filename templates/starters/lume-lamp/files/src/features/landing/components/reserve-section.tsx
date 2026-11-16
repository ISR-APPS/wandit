// The reserve chapter: the order card with the edition meter, beside the colorway cards, the quantity, and the total.
// LandingPage renders it with the page colorway, so a choice here also changes the hero, and the other way round.
// The action is a mailto link with the choice written in. No form posts data (see STARTER.md for a real order form).
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { COLORWAYS, type Colorway } from "../lib/colorways";
import {
	formatPrice,
	PRICE_USD,
	REGULAR_PRICE_USD,
	reservationMailto,
} from "../lib/offer";
import { KICKER, MICRO, WRAP } from "../lib/type-styles";
import { ColorwayPhoto } from "./colorway-photo";
import { EditionMeter } from "./edition-meter";
import { PillArrow } from "./pill-arrow";
import { QuantityStepper } from "./quantity-stepper";

type ReserveSectionProps = {
	colorway: Colorway;
	onColorwayChange: (colorway: Colorway) => void;
};

/** Grid .88fr / 1.12fr on the soft paper, with a hairline above and below. The order card is sticky from 1024px. */
export function ReserveSection({
	colorway,
	onColorwayChange,
}: ReserveSectionProps) {
	const { t } = useT();
	const [quantity, setQuantity] = useState(1);
	const chosen = COLORWAYS.find((option) => option.id === colorway);
	const colorwayName = chosen === undefined ? "" : t(chosen.nameKey);
	const total = formatPrice(quantity * PRICE_USD);
	const choice = t("reserve.mailChoice")
		.replace("{colorway}", colorwayName)
		.replace("{quantity}", String(quantity));
	const mailHref = reservationMailto({
		subject: t("reserve.mailSubject").replace("{choice}", choice),
		lines: [
			t("reserve.mailBodyIntro"),
			t("reserve.mailBodyLamp").replace("{choice}", choice),
			t("reserve.mailBodyTotal").replace("{total}", total),
			"",
			t("reserve.mailBodyName"),
		],
	});
	const nextSteps = [
		t("reserve.next1"),
		t("reserve.next2"),
		t("reserve.next3"),
	];
	return (
		<section
			id="reserve"
			aria-labelledby="reserve-title"
			className="scroll-mt-[4.5rem] overflow-clip border-foreground/16 border-y bg-(--lume-paper-soft) py-[clamp(5rem,11vh,8.5rem)]"
		>
			<div
				className={`${WRAP} grid items-start gap-[clamp(2.5rem,6vw,6rem)] lg:grid-cols-[0.88fr_1.12fr]`}
			>
				{/* On a phone the title and the choice come first. The photo and the meter follow them. */}
				<aside
					data-reveal
					className="max-w-[24rem] max-lg:order-last lg:sticky lg:top-[6.5rem] lg:max-w-none"
				>
					<ColorwayPhoto
						colorway={colorway}
						className="lume-arch-order lume-photo-shadow-small"
						isHero={false}
						isDecorative
					/>
					<EditionMeter />
				</aside>

				<div data-reveal>
					<p className={`${KICKER} mb-[1.2rem]`}>{t("reserve.kicker")}</p>
					<h2
						id="reserve-title"
						className="mb-[0.6rem] font-display font-medium text-[clamp(1.9rem,3.4vw,2.9rem)] tracking-[-0.01em]"
					>
						{t("reserve.title")}{" "}
						<span className="lume-turn text-[1.02em]">
							{t("reserve.titleTurn")}
						</span>
					</h2>
					<p className="mb-[2.4rem] max-w-[32em] text-foreground/72">
						{t("reserve.sub")}
					</p>

					<fieldset className="mb-[1.8rem]">
						<legend className={`${MICRO} mb-[0.9rem]`}>
							{t("reserve.colorway")}
						</legend>
						<div className="grid gap-4 sm:grid-cols-2">
							{COLORWAYS.map((option) => (
								<label
									key={option.id}
									className="lume-swatch relative flex cursor-pointer items-center gap-[0.9rem] rounded-[0.9rem] px-[1.1rem] py-4"
								>
									<input
										type="radio"
										name="reserve-colorway"
										value={option.id}
										checked={option.id === colorway}
										onChange={() => onColorwayChange(option.id)}
										className="pointer-events-none absolute opacity-0"
									/>
									<span
										aria-hidden="true"
										className={`lume-chip lume-chip-${option.id} size-[2.1rem] flex-none rounded-full`}
									/>
									<span>
										<span className="block font-medium text-[0.98rem]">
											{t(option.nameKey)}
										</span>
										<span className="block text-[0.78rem] text-foreground/52">
											{t(option.baseKey)}
										</span>
									</span>
									<span
										aria-hidden="true"
										className="lume-check ms-auto grid size-[1.15rem] flex-none place-items-center rounded-full"
									/>
								</label>
							))}
						</div>
					</fieldset>

					<QuantityStepper quantity={quantity} onQuantityChange={setQuantity} />

					<div className="flex flex-wrap items-center justify-between gap-6 border-foreground/16 border-t pt-[1.6rem]">
						<p className="text-[0.82rem] text-foreground/52 uppercase tracking-[0.1em]">
							{t("reserve.total")}
							<span className="mt-1 block font-display font-semibold text-[2rem] text-foreground normal-case tabular-nums tracking-[-0.01em]">
								<span aria-live="polite">{total}</span>
								<s className="lume-struck ms-[0.5em] font-normal font-sans text-[0.95rem] text-foreground/52 tracking-normal">
									<span className="sr-only">{t("hero.regularPrice")} </span>
									{formatPrice(quantity * REGULAR_PRICE_USD)}
								</s>
							</span>
						</p>
						<a
							href={mailHref}
							className="lume-btn w-full justify-center sm:w-auto"
						>
							{t("reserve.send")}
							<PillArrow />
						</a>
						<p className="w-full text-[0.8rem] text-foreground/52">
							{t("reserve.note")}
						</p>
					</div>

					<div className="mt-10">
						<p className={`${MICRO} mb-3`}>{t("reserve.nextTitle")}</p>
						<ol>
							{nextSteps.map((step, index) => (
								<li
									key={step}
									className="grid grid-cols-[3.4rem_1fr] items-baseline border-foreground/16 border-t py-3 text-[0.92rem] text-foreground/72 last:border-b"
								>
									<span className="font-display font-medium text-(--lume-brass-deep) text-[0.85rem] tracking-[0.1em]">
										{`${t("site.numberSign")} ${String(index + 1).padStart(2, "0")}`}
									</span>
									{step}
								</li>
							))}
						</ol>
					</div>
				</div>
			</div>
		</section>
	);
}
