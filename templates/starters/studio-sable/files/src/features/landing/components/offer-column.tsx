// One offer of the services section: an accent numeral, a title, three deliverables, and a starting price.
// OffersSection renders four of them. landing.css places the columns and their hairlines (class sable-offer).
import { MONO, SQUARE } from "../lib/type-styles";

/** One offer. Every text is already translated. */
export type Offer = {
	/** Two digits, for example "01". Not translated. It is also the React key. */
	number: string;
	title: string;
	/** The three deliverables, in the order of the work. */
	items: readonly string[];
	/** The starting price with its currency, for example "from 480 000 DA". */
	price: string;
	/** The real lead time, for example "11 weeks". */
	duration: string;
};

type OfferColumnProps = { offer: Offer };

/** A column of the offers ledger. The price sits at the foot, so the four prices align. */
export function OfferColumn({ offer }: OfferColumnProps) {
	return (
		<article className="sable-offer sable-fade">
			<p className="font-display font-medium text-[clamp(2.2rem,4vw,3.4rem)] text-primary leading-[0.9] tracking-[-0.04em]">
				{offer.number}
			</p>
			<h3 className="font-display font-medium text-[clamp(1.15rem,1.6vw,1.45rem)] leading-[1.12] tracking-[-0.025em]">
				{offer.title}
			</h3>
			<ul className={`${MONO} flex flex-col gap-2 text-foreground/80`}>
				{offer.items.map((item) => (
					<li key={item} className="flex items-start gap-[9px]">
						<span
							aria-hidden="true"
							className={`${SQUARE} mt-1.5 bg-primary`}
						/>
						{item}
					</li>
				))}
			</ul>
			<p
				className={`${MONO} mt-auto border-foreground/14 border-t pt-4 text-foreground`}
			>
				<span className="block text-[13.5px]">{offer.price}</span>
				<span className="text-foreground/55">{offer.duration}</span>
			</p>
		</article>
	);
}
