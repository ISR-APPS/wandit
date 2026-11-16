// Section 02, the shelf: the priced index of the eight pieces of the week. A wall label beside it follows the scroll.
// LandingPage renders it. It reads SHELF_PIECES of lib/pieces.ts and the "shelf" group of messages.ts.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { SHELF_PIECES, STOCKROOM_COUNT } from "../lib/pieces";
import { BAND, KICKER, MONO, NOTE, WRAP } from "../lib/type-styles";
import { ShelfRow } from "./shelf-row";

/** The six column heads, in the order of the tracks of landing.css. Only the price is at the end side. */
const COLUMNS: readonly { labelKey: TranslationKey; isAtEnd?: boolean }[] = [
	{ labelKey: "shelf.colRef" },
	{ labelKey: "shelf.colPiece" },
	{ labelKey: "shelf.colMaterial" },
	{ labelKey: "shelf.colDimensions" },
	{ labelKey: "shelf.colPrice", isAtEnd: true },
	{ labelKey: "shelf.colStatus" },
];

const IN_STOCK_COUNT = SHELF_PIECES.filter((piece) => piece.isInStock).length;

/** From 1180px the label takes 26% and sticks under the header. Below, it stands over the table. */
export function ShelfSection() {
	const { t } = useT();
	return (
		<section id="shelf" className={BAND}>
			<div
				className={`${WRAP} grid gap-[clamp(26px,3vw,44px)] min-[1180px]:grid-cols-[minmax(0,26fr)_minmax(0,74fr)]`}
			>
				<div
					data-reveal=""
					className="min-[1180px]:sticky min-[1180px]:top-24 min-[1180px]:self-start"
				>
					{/* Between 860px and 1179px the label has the full width: the title and the note share one row. */}
					<div className="nour-fade min-[1180px]:block min-[860px]:grid min-[860px]:grid-cols-2 min-[860px]:items-end min-[860px]:gap-10">
						<div>
							<p className={KICKER}>{t("shelf.kicker")}</p>
							<h2 className="mt-3.5 max-w-[16ch] font-display font-medium text-[clamp(1.45rem,2.3vw,2rem)] leading-[1.04] tracking-[-0.025em]">
								{t("shelf.title")}
							</h2>
						</div>
						<div>
							<p
								className={`${NOTE} mt-[18px] max-w-[52ch] min-[1180px]:mt-[18px] min-[860px]:mt-0`}
							>
								{t("shelf.note")}
							</p>
							<p className={`${MONO} mt-[22px] min-[860px]:mt-3.5`}>
								{t("shelf.updated")}
							</p>
						</div>
					</div>
				</div>

				<div data-reveal="">
					<div
						aria-hidden="true"
						className="nour-shelf-head nour-fade border-foreground border-b pb-[9px]"
					>
						{COLUMNS.map((column) => (
							<span
								key={column.labelKey}
								className={cn(MONO, column.isAtEnd && "text-end")}
							>
								{t(column.labelKey)}
							</span>
						))}
					</div>
					<ol className="border-foreground border-t min-[860px]:border-t-0">
						{SHELF_PIECES.map((piece) => (
							<ShelfRow key={piece.ref} piece={piece} />
						))}
					</ol>
					<p
						className={`${MONO} nour-fade flex flex-wrap justify-between gap-x-6 gap-y-1 pt-3`}
					>
						<span>
							{SHELF_PIECES.length} {t("shelf.footLines")} ·{" "}
							{STOCKROOM_COUNT - SHELF_PIECES.length} {t("shelf.footMore")}
						</span>
						<span>
							{IN_STOCK_COUNT} {t("pieces.inStock")} ·{" "}
							{SHELF_PIECES.length - IN_STOCK_COUNT} {t("pieces.soldOut")}
						</span>
					</p>
				</div>
			</div>
		</section>
	);
}
