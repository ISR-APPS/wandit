// One gift card plate: a label, a title, a sentence, and at its foot the price above a hairline.
// GiftCardsSection renders three of them on a staircase of offsets.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BODY_TEXT, ITEM_TITLE, LABEL, META } from "../lib/styles";

type GiftCardProps = {
	/** Translated card name, for example "discovery card". */
	label: string;
	/** Translated title of what the card gives. */
	title: string;
	/** Translated sentence about the card. */
	body: string;
	/** Translated price in dinars, digits only, for example "7 200". */
	price: string;
	/** Translated duration, shown opposite the price. */
	duration: string;
	/** Offset classes of the staircase, for example "lg:mt-[clamp(1rem,3.4vh,2.6rem)]". */
	className?: string;
};

/** A flat <article> on ground A with a 16% hairline. The world allows no shadow. */
export function GiftCard({
	label,
	title,
	body,
	price,
	duration,
	className,
}: GiftCardProps) {
	const { t } = useT();
	return (
		<article
			data-reveal=""
			className={cn(
				"flex flex-col gap-[0.85rem] rounded-lg border border-(--onde-hair) bg-background p-[clamp(1.5rem,2.4vw,2.1rem)]",
				className,
			)}
		>
			<p className={LABEL}>{label}</p>
			<h3 className={ITEM_TITLE}>{title}</h3>
			<p className={cn(BODY_TEXT, "text-[0.93rem] leading-[1.65]")}>{body}</p>
			<p className="mt-auto flex items-baseline justify-between gap-4 border-(--onde-hair) border-t pt-[1.1rem]">
				<span className="whitespace-nowrap font-display text-[clamp(1.3rem,1.85vw,1.7rem)] tabular-nums">
					{price}
					<span className="ms-1.5 font-sans text-(--onde-ink-66) text-[0.68rem] tracking-[0.14em]">
						{t("treatments.currency")}
					</span>
				</span>
				<span className={cn(META, "text-end")}>{duration}</span>
			</p>
		</article>
	);
}
