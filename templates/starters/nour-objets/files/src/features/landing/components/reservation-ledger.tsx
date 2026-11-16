// The reservation ledger: the pieces on the list of the visitor and the total. It also gives two ways to send the list.
// VisitSection renders it. It reads the basket of ReservationProvider and the "visit" group of messages.ts.
// It posts no data. The email link carries the references and the total in its subject and its body.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { formatAmount, MAX_RESERVED_PIECES, SHELF_PIECES } from "../lib/pieces";
import {
	BUTTON_FILL,
	BUTTON_GHOST,
	LEDGER_LABEL,
	MONO,
	NOTE,
} from "../lib/type-styles";
import { Price } from "./price";
import { useReservation } from "./reservation-provider";

/** The list changes when the visitor uses a reserve button of the page. An empty list shows one sentence. */
export function ReservationLedger() {
	const { t } = useT();
	const { refs, toggle } = useReservation();
	const pieces = refs.flatMap((ref) =>
		SHELF_PIECES.filter((piece) => piece.ref === ref),
	);
	const hasPieces = pieces.length > 0;
	const total = pieces.reduce((sum, piece) => sum + piece.price, 0);

	// An email client can show the narrow space of formatAmount as a box. The message uses a plain space.
	const mailAmount = (amount: number) =>
		`${formatAmount(amount).replaceAll("\u202f", " ")} ${t("site.currency")}`;
	const mailLines = hasPieces
		? [
				t("visit.mailIntro"),
				...pieces.map(
					(piece) =>
						`- ${piece.ref} ${t(piece.nameKey)}: ${mailAmount(piece.price)}`,
				),
				`${t("visit.total")}: ${mailAmount(total)}`,
			]
		: [t("visit.mailIntroEmpty")];
	const mailSubject = hasPieces
		? `${t("visit.mailSubject")} ${refs.join(", ")}`
		: t("visit.mailSubjectEmpty");
	const mailBody = [...mailLines, "", t("visit.mailClosing")].join("\n");
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

	return (
		<div className="nour-fade">
			<div className="flex items-baseline justify-between gap-3.5 border-foreground border-b pb-[9px]">
				<h3 className={cn(MONO, "text-foreground")}>{t("visit.listHead")}</h3>
				<span className={cn(MONO, hasPieces && "text-primary")}>
					{pieces.length} / {MAX_RESERVED_PIECES}
				</span>
			</div>
			<ol aria-live="polite">
				{!hasPieces && (
					<li className="border-foreground/9 border-b py-[13px] text-[14px] text-muted-foreground leading-[1.5]">
						{t("visit.listEmpty")}
					</li>
				)}
				{pieces.map((piece) => (
					<li
						key={piece.ref}
						className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-foreground/9 border-b py-1"
					>
						<div>
							<span className="block font-medium text-[14.5px] leading-[1.3]">
								{t(piece.nameKey)}
							</span>
							<span className={`${MONO} mt-0.5 block`}>
								{t("pieces.ref")} {piece.ref}
							</span>
						</div>
						<span className="nour-mono font-medium text-[12.5px]">
							<Price amount={piece.price} />
						</span>
						<button
							type="button"
							onClick={() => toggle(piece.ref)}
							aria-label={`${t("visit.remove")}: ${t(piece.nameKey)}`}
							className="nour-mono -me-2 inline-flex min-h-11 cursor-pointer items-center px-2 text-[10px] text-muted-foreground uppercase tracking-[0.11em] underline-offset-4 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
						>
							{t("visit.remove")}
						</button>
					</li>
				))}
			</ol>
			<dl className="flex items-baseline justify-between gap-3.5 border-foreground border-b py-3.5">
				<dt className={LEDGER_LABEL}>{t("visit.total")}</dt>
				<dd className="nour-mono font-medium text-[16px]">
					<Price amount={total} />
				</dd>
			</dl>
			<p className={`${MONO} mt-3`}>{t("visit.limit")}</p>

			<div className="mt-6 flex flex-wrap items-center gap-2.5">
				<a href={mailHref} className={BUTTON_FILL}>
					{t(hasPieces ? "visit.send" : "visit.write")}
				</a>
				<a href={t("site.phoneHref")} className={BUTTON_GHOST}>
					{t("visit.call")}
				</a>
			</div>
			<p className={`${NOTE} mt-4 max-w-[54ch] text-[13.5px]`}>
				{t("visit.sendNote")}
			</p>
		</div>
	);
}
