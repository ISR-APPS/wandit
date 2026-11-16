// The label under a plinth: the name, then the mono line with the reference, the material, and the price.
// The hero, the window, and the quote band render it. No photo of the page stands without this label.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Piece } from "../lib/pieces";
import { DOT } from "../lib/type-styles";
import { Price } from "./price";

type PieceCaptionProps = {
	piece: Piece;
	/** "full" adds the stock square and the dimensions. "short" is the label of a narrow window cell. */
	detail: "full" | "short";
};

/**
 * The price is always the last item of the label, in ink.
 * Each item ends with its separator dot and does not break. A narrow plate wraps only between items.
 * So a wrapped line ends with a dot and never starts with one.
 */
export function PieceCaption({ piece, detail }: PieceCaptionProps) {
	const { t } = useT();
	const isFull = detail === "full";
	return (
		<div>
			<h3
				className={cn(
					"font-display font-medium leading-[1.2] tracking-[-0.012em]",
					isFull ? "text-[15px]" : "text-[13.5px]",
				)}
			>
				{t(piece.nameKey)}
			</h3>
			<p
				className={cn(
					"nour-mono text-muted-foreground uppercase leading-[1.5]",
					isFull
						? "mt-2 text-[10.5px] tracking-[0.045em]"
						: "mt-1.5 text-[10px] tracking-[0.035em]",
				)}
			>
				<span className="whitespace-nowrap">
					{isFull && (
						<span
							aria-hidden="true"
							className={cn(
								DOT,
								piece.isInStock ? "bg-primary" : "bg-muted-foreground",
							)}
						/>
					)}
					{t("pieces.ref")} {piece.ref} ·
				</span>{" "}
				<span className="whitespace-nowrap">{t(piece.materialKey)}</span>
				<br />
				{isFull && (
					<>
						<span className="whitespace-nowrap">
							{t(piece.dimensionsKey)} ·
						</span>{" "}
					</>
				)}
				<b className="font-medium text-foreground">
					<Price amount={piece.price} />
				</b>
			</p>
		</div>
	);
}
