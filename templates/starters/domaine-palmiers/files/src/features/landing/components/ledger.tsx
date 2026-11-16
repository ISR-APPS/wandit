// A ledger: facts in hairline rows of key and value. The DOMAINE world uses it in place of cards.
// The estate sheet, the specification, and the sales office render it.
import { cn } from "~/shared/lib/utils";
import { KEY_LABEL } from "../lib/type-styles";

/** One row of a ledger. Both texts are already translated. */
export type LedgerRow = {
	/** The small bronze key, for example "Delivery". */
	label: string;
	/** The value, for example "December 2027". */
	value: string;
	/** A "tel:" or "mailto:" address. The value is then a link. */
	href?: string;
};

type LedgerProps = {
	rows: readonly LedgerRow[];
	/** "split": the key beside a serif value. "stacked": the key above a longer value in the text face. */
	layout: "split" | "stacked";
	className?: string;
};

/** A description list with a stronger rule above the first row. */
export function Ledger({ rows, layout, className }: LedgerProps) {
	const isSplit = layout === "split";
	return (
		<dl className={cn("border-foreground/24 border-t", className)}>
			{rows.map((row) => (
				<div
					key={row.label}
					className={cn(
						"grid border-foreground/12 border-b",
						isSplit
							? "grid-cols-[minmax(96px,34%)_minmax(0,1fr)] items-baseline gap-4 py-[0.85rem]"
							: "gap-[0.3rem] py-[0.8rem]",
					)}
				>
					<dt className={KEY_LABEL}>{row.label}</dt>
					<dd
						className={
							isSplit
								? "font-display text-[clamp(0.98rem,1.15vw,1.14rem)] leading-[1.35]"
								: "text-[0.98rem] text-foreground/75 leading-[1.55]"
						}
					>
						{row.href === undefined ? (
							row.value
						) : (
							// The link is 44px high on a phone for touch. From 1024px it keeps the height of the other rows.
							<a
								href={row.href}
								className="dlp-underline inline-flex min-h-11 items-center hover:text-(--dlp-bronze-deep) lg:min-h-0 lg:py-1"
							>
								{row.value}
							</a>
						)}
					</dd>
				</div>
			))}
		</dl>
	);
}
