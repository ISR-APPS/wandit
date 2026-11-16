// One price card: the plan name, the price with its unit in blue, the claims, and one action.
// PricingSection renders two of them. The recommended one has a blue edge and the warm flag.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CheckList } from "./check-list";
import { PillLink } from "./pill-link";

type PriceCardProps = {
	/** The plan name, for example "Business". */
	name: string;
	/** One sentence that says who the plan is for. */
	audience: string;
	/** The monthly price in dinars, already formatted, for example "2,900". */
	price: string;
	/** The claims of the plan, already translated. */
	points: readonly string[];
	/** The text of the action. It links to the contact section. */
	actionLabel: string;
	/** The text of the warm flag. With a flag, the card is the recommended plan. */
	flag?: string;
};

/** The action sits at the foot of the card. The recommended card sits 10px higher, so its action does too. */
export function PriceCard({
	name,
	audience,
	price,
	points,
	actionLabel,
	flag,
}: PriceCardProps) {
	const { t } = useT();
	const isRecommended = flag !== undefined;
	return (
		<div
			className={cn(
				"fw-card fw-card-lift relative flex h-full flex-col p-[clamp(1.7rem,3vw,2.3rem)]",
				isRecommended && "fw-card-featured",
			)}
		>
			{/* Warm moment 3 of 3: the flag of the recommended plan. */}
			{isRecommended ? (
				<span className="dark fw-warm absolute end-5.5 -top-3.5 rounded-full px-4 py-1.5 font-bold font-display text-[0.74rem] leading-normal">
					{flag}
				</span>
			) : null}
			<h3 className="font-display font-extrabold text-[1.1rem]">{name}</h3>
			<p className="mt-1 text-[0.9rem] text-muted-foreground">{audience}</p>
			<p className="mt-5 font-display font-extrabold text-[clamp(2rem,3.4vw,2.6rem)] tabular-nums leading-none tracking-[-0.02em]">
				{price}{" "}
				<span className="font-bold text-[0.42em] text-primary tracking-normal">
					{t("pricing.perMonth")}
				</span>
			</p>
			<CheckList
				items={points}
				tone="muted"
				className="mt-6 mb-7 gap-3 text-[0.94rem]"
			/>
			<PillLink
				href="#contact"
				tone={isRecommended ? "primary" : "secondary"}
				className="mt-auto w-full"
			>
				{actionLabel}
			</PillLink>
		</div>
	);
}
