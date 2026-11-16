// The lots section: the price table of the lots that remain, and a note that refuses urgency.
// LandingPage renders it on the first ground. Its id "lots" is the target of the header link and of the hero link.
// The rows come from lib/lots.ts. Below 768px each row is a framed block, and each cell prints its column name.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { LOT_STATUS_KEYS, REMAINING_LOTS } from "../lib/lots";
import { CAPTION, KEY_LABEL, SECTION, WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";

const HEAD_CELL = `${KEY_LABEL} whitespace-nowrap border-foreground/24 border-b pe-4 pb-[0.8rem] text-start`;

// From 768px: a table cell on a hairline. Below: one cell of the block, the column name above the value.
// The column name comes from the data-label attribute of the cell.
const CELL =
	"font-display text-[clamp(0.95rem,1.1vw,1.1rem)] max-md:flex max-md:min-w-0 max-md:flex-col max-md:gap-[0.3rem] max-md:before:font-sans max-md:before:font-semibold max-md:before:text-(--dlp-bronze-deep) max-md:before:text-[10px] max-md:before:uppercase max-md:before:leading-[1.5] max-md:before:tracking-[0.18em] max-md:before:content-[attr(data-label)] md:border-foreground/12 md:border-b md:py-[1.05rem] md:pe-4 md:align-baseline";

// Below 768px a row is a framed block of three lines with two cells each. The blocks share their borders.
const ROW =
	"max-md:-mb-px max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-[0.95rem] max-md:border max-md:border-foreground/12 max-md:px-[1.1rem] max-md:py-[1.1rem] md:last:[&>td]:border-foreground/24";

/** A real <table>, so a screen reader reads each price with its column. The last rule is stronger: it closes the table. */
export function LotsSection() {
	const { t } = useT();
	return (
		<section
			id="lots"
			aria-labelledby="lots-title"
			className={cn(SECTION, "scroll-mt-16")}
		>
			<div className={WRAP}>
				<SectionHead
					titleId="lots-title"
					label={t("lots.label")}
					titleLines={[t("lots.titleLine1"), t("lots.titleLine2")]}
					lede={t("lots.lede")}
					className="mb-[clamp(2.4rem,4vw,4rem)]"
				/>
				<table
					data-reveal="lift"
					className="w-full border-collapse text-start max-md:block"
				>
					<caption className="sr-only">{t("lots.tableCaption")}</caption>
					<thead className="max-md:hidden">
						<tr>
							<th scope="col" className={HEAD_CELL}>
								{t("lots.columnLot")}
							</th>
							<th scope="col" className={HEAD_CELL}>
								{t("lots.columnType")}
							</th>
							<th scope="col" className={HEAD_CELL}>
								{t("lots.columnSurface")}
							</th>
							<th scope="col" className={HEAD_CELL}>
								{t("lots.columnBedrooms")}
							</th>
							<th scope="col" className={HEAD_CELL}>
								{t("lots.columnPrice")}
							</th>
							<th scope="col" className={cn(HEAD_CELL, "pe-0")}>
								{t("lots.columnStatus")}
							</th>
						</tr>
					</thead>
					<tbody className="max-md:block">
						{REMAINING_LOTS.map((lot) => (
							<tr key={lot.ref} className={ROW}>
								<td data-label={t("lots.columnLot")} className={CELL}>
									{lot.ref}
								</td>
								<td data-label={t("lots.columnType")} className={CELL}>
									{t(lot.typeKey)}
								</td>
								<td data-label={t("lots.columnSurface")} className={CELL}>
									{t(lot.surfaceKey)}
								</td>
								<td data-label={t("lots.columnBedrooms")} className={CELL}>
									{lot.bedrooms}
								</td>
								<td data-label={t("lots.columnPrice")} className={CELL}>
									{t(lot.priceKey)}
								</td>
								<td
									data-label={t("lots.columnStatus")}
									className={cn(CELL, "md:pe-0")}
								>
									{/* Product rule of the world: only a free lot prints in bronze. The other states stay quiet. */}
									<span
										className={cn(
											"inline-flex items-center gap-2 whitespace-nowrap font-sans font-semibold text-[10px] uppercase leading-none tracking-[0.16em]",
											lot.status === "available"
												? "text-(--dlp-bronze-deep)"
												: "text-muted-foreground",
										)}
									>
										{/* A square of 6px: full for a free lot, open for an option, faint for a reserved lot. */}
										<span
											aria-hidden="true"
											className={cn(
												"size-1.5 shrink-0",
												lot.status === "available" && "bg-(--dlp-bronze-deep)",
												lot.status === "option" &&
													"border border-muted-foreground",
												lot.status === "reserved" && "bg-muted-foreground/45",
											)}
										/>
										{t(LOT_STATUS_KEYS[lot.status])}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				<p
					data-reveal="lift"
					className={cn(CAPTION, "mt-[1.6rem] max-w-[62ch]")}
				>
					{t("lots.note")}
				</p>
			</div>
		</section>
	);
}
