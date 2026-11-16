// One line of the shelf: reference, piece, material, dimensions, price, status.
// ShelfSection renders one row for each piece of lib/pieces.ts. landing.css holds the six tracks and the fold below 860px.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Piece } from "../lib/pieces";
import { DOT, MONO } from "../lib/type-styles";
import { Price } from "./price";

/**
 * A sold-out line stays on the shelf: its name turns grey, and its price is struck.
 * Below 860px the row folds into three lines: reference and status, name and price, material and dimensions.
 * The column heads of ShelfSection are hidden from a screen reader, so each mono cell reads its own label.
 */
export function ShelfRow({ piece }: { piece: Piece }) {
	const { t } = useT();
	const { isInStock } = piece;
	return (
		<li className="nour-shelf-row nour-fade items-baseline border-foreground/9 border-b py-[15px]">
			<span className={cn(MONO, "order-1 min-[860px]:order-none")}>
				<span className="sr-only">{t("shelf.colRef")}: </span>
				{piece.ref}
			</span>
			<span
				className={cn(
					"order-3 font-medium text-[15.5px] leading-[1.3] tracking-[-0.012em] min-[860px]:order-none",
					!isInStock && "text-muted-foreground",
				)}
			>
				{t(piece.nameKey)}
			</span>
			<span className={cn(MONO, "order-5 min-[860px]:order-none")}>
				<span className="sr-only">{t("shelf.colMaterial")}: </span>
				{t(piece.materialKey)}
			</span>
			<span
				className={cn(
					MONO,
					"order-6 whitespace-nowrap text-end min-[860px]:order-none min-[860px]:text-start",
				)}
			>
				<span className="sr-only">{t("shelf.colDimensions")}: </span>
				{t(piece.dimensionsKey)}
			</span>
			<span
				className={cn(
					"nour-mono order-4 text-end font-medium text-[13px] tracking-[0.02em] min-[860px]:order-none",
					!isInStock && "text-muted-foreground line-through",
				)}
			>
				<span className="sr-only">{t("shelf.colPrice")}: </span>
				<Price amount={piece.price} />
			</span>
			<span
				className={cn(
					MONO,
					"order-2 whitespace-nowrap text-end min-[860px]:order-none min-[860px]:text-start",
				)}
			>
				<span
					aria-hidden="true"
					className={cn(DOT, isInStock ? "bg-primary" : "bg-muted-foreground")}
				/>
				{t(isInStock ? "pieces.inStock" : "pieces.soldOut")}
			</span>
		</li>
	);
}
