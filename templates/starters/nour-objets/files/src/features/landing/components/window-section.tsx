// Section 03, the window: six plinths with a reserve button each, and the sort bar over them.
// LandingPage renders it. hooks/use-window-sort.ts moves the cells into price order with the scroll.
// On a wide and tall screen the hook pins the stage, so the sort plays while the section stands still.
// It reads WINDOW_PIECES of lib/pieces.ts and the "window" group of messages.ts.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useWindowSort } from "../hooks/use-window-sort";
import { WINDOW_PIECES } from "../lib/pieces";
import { BAND, KICKER, MONO, NOTE, TITLE, WRAP } from "../lib/type-styles";
import { PieceCaption } from "./piece-caption";
import { Plinth } from "./plinth";
import { ReserveButton } from "./reserve-button";

/**
 * For each cell in the order of arrival, its place in the price order, from the lowest price.
 * Two equal prices keep their order of arrival, so no two cells get the same slot.
 */
const PRICE_SLOT_OF_CELL: readonly number[] = WINDOW_PIECES.map(
	(piece, index) =>
		WINDOW_PIECES.filter(
			(other, otherIndex) =>
				other.price < piece.price ||
				(other.price === piece.price && otherIndex < index),
		).length,
);

/** A label of the sort bar. landing.css sets its color: ink for the current order, grey for the other one. */
const SORT_LABEL = "nour-mono text-[11px] uppercase tracking-[0.11em]";

/**
 * Six plinths on one row from 1101px, three from 621px, two below. The grid keeps the order of arrival with no script.
 * The runway after the stage is 110% of the screen height: the length of the pinned sort.
 */
export function WindowSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	useWindowSort(sectionRef, gridRef, PRICE_SLOT_OF_CELL);
	return (
		<section
			id="window"
			ref={sectionRef}
			className={cn(BAND, "pt-[clamp(4rem,9vh,6.4rem)]")}
		>
			{/* The stage sticks under the header while the runway scrolls. The hook turns the pin on. */}
			<div data-window-stage="" className={`${WRAP} nour-window-stage`}>
				<div
					data-reveal=""
					className="grid items-end gap-[18px] min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,34ch)]"
				>
					<div className="nour-fade">
						<p className={KICKER}>{t("window.kicker")}</p>
						<h2 className={`${TITLE} mt-3.5 max-w-[19ch]`}>
							{t("window.title")}
						</h2>
					</div>
					<p className={`${NOTE} nour-fade max-w-[52ch]`}>{t("window.note")}</p>
				</div>

				<div className="mt-[clamp(24px,3vw,36px)] flex flex-wrap items-center justify-between gap-x-[clamp(14px,2.6vw,34px)] gap-y-2 pb-2.5">
					<span className={`${SORT_LABEL} nour-sort-from`}>
						{t("window.sortArrival")}
					</span>
					{/* Below 701px the line takes its own row under the two labels. */}
					<span
						aria-hidden="true"
						className="relative order-3 h-px min-w-20 flex-[1_1_100%] bg-foreground/16 min-[701px]:order-none min-[701px]:flex-[1_1_120px]"
					>
						<span className="nour-sort-fill absolute inset-0 bg-foreground" />
					</span>
					<span className={`${SORT_LABEL} nour-sort-to`}>
						{t("window.sortPrice")}
					</span>
				</div>

				<div
					ref={gridRef}
					className="relative grid grid-cols-2 gap-x-[clamp(9px,1.1vw,15px)] gap-y-7 border-foreground/16 border-t pt-[18px] min-[1101px]:grid-cols-6 min-[621px]:grid-cols-3"
				>
					{WINDOW_PIECES.map((piece) => (
						<article
							key={piece.ref}
							data-window-cell=""
							className="nour-window-cell flex flex-col gap-2.5 bg-background"
						>
							<Plinth piece={piece} />
							{/* Three caption lines at most. The fixed height keeps the six buttons on one line. */}
							<div className="min-h-[68px]">
								<PieceCaption piece={piece} detail="short" />
							</div>
							<ReserveButton
								pieceRef={piece.ref}
								label={t("window.reserve")}
								size="small"
							/>
						</article>
					))}
				</div>

				<div className="mt-[clamp(20px,2.4vw,30px)] flex flex-wrap justify-between gap-x-[18px] gap-y-1">
					<p className={MONO}>{t("window.footCount")}</p>
					<p className={MONO}>{t("window.footHold")}</p>
				</div>
			</div>
			<div
				data-window-runway=""
				aria-hidden="true"
				className="nour-window-runway"
			/>
		</section>
	);
}
