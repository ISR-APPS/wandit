// Section 04, the room and the cellar: a full-width photo band, the room text, and the ageing register.
// LandingPage renders it on the first ground. It reads REGISTER_ROWS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { REGISTER_ROWS } from "../lib/content";
import {
	BODY_TEXT,
	FIGURE,
	MICRO_LABEL,
	SECTION_TITLE,
} from "../lib/type-styles";
import { Eyebrow } from "./eyebrow";
import { PhotoCaption } from "./photo-caption";

// The head and cell rules of the register: a 22% rule under the head, 12% rules between rows.
const HEAD_CELL = cn(
	MICRO_LABEL,
	"border-(--br-hair-strong) border-b ps-3 pb-3 text-[10.5px] first:ps-0 last:text-end",
);
const BODY_CELL =
	"border-(--br-hair) border-b py-3.5 ps-3 align-baseline text-[clamp(12.5px,0.95vw,15px)] text-foreground/72 first:ps-0 max-[520px]:ps-2";

/** The band opens the section before any type. The register is the butcher's board, set as a table. */
export function RoomSection() {
	const { t } = useT();
	return (
		<section
			id="room"
			aria-labelledby="room-title"
			className="br-section br-room bg-background"
		>
			<figure className="br-band br-scrim" data-reveal="rise">
				<img
					src="/images/long-table.webp"
					width={1600}
					height={900}
					alt={t("room.bandAlt")}
					loading="lazy"
					className="br-photo"
				/>
				<div aria-hidden="true" className="br-band__edge" />
			</figure>
			<div className="br-wrap br-room__grid">
				<div data-reveal="rise">
					<Eyebrow className="mb-[clamp(14px,1.6vw,22px)]">
						{t("room.eyebrow")}
					</Eyebrow>
					<h2
						id="room-title"
						className={cn(
							SECTION_TITLE,
							"mb-[18px] max-w-[14ch] text-[clamp(1.9rem,3.9vw,3.15rem)] leading-[1.02]",
						)}
					>
						{t("room.title")}
					</h2>
					<span aria-hidden="true" className="br-uline" />
					<p className={cn(BODY_TEXT, "mt-[clamp(18px,2.4vw,28px)]")}>
						{t("room.body")}
					</p>
					<PhotoCaption>{t("room.note")}</PhotoCaption>
				</div>
				<div data-reveal="rise">
					<table className="w-full border-collapse text-start">
						<caption
							className={cn(MICRO_LABEL, "pb-3.5 text-start tracking-[0.16em]")}
						>
							{t("room.registerCaption")}
						</caption>
						<thead>
							<tr>
								<th scope="col" className={cn(HEAD_CELL, "text-start")}>
									{t("room.colCut")}
								</th>
								<th scope="col" className={cn(HEAD_CELL, "text-start")}>
									{t("room.colOrigin")}
								</th>
								<th scope="col" className={cn(HEAD_CELL, "text-start")}>
									{t("room.colAgeing")}
								</th>
								<th scope="col" className={HEAD_CELL}>
									{t("room.colWeight")}
								</th>
							</tr>
						</thead>
						<tbody>
							{REGISTER_ROWS.map((row) => (
								<tr key={row.cutKey}>
									<th
										scope="row"
										className={cn(
											BODY_CELL,
											"text-start font-display font-semibold text-[clamp(13.5px,1.05vw,16.5px)] text-foreground tracking-[-0.015em]",
										)}
									>
										{t(row.cutKey)}
									</th>
									<td className={BODY_CELL}>{t(row.originKey)}</td>
									<td
										className={cn(
											BODY_CELL,
											FIGURE,
											"font-semibold text-foreground",
										)}
									>
										{t(row.ageingKey)}
									</td>
									<td
										className={cn(
											BODY_CELL,
											FIGURE,
											"whitespace-nowrap text-end font-semibold text-foreground",
										)}
									>
										{t(row.weightKey)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					<PhotoCaption>{t("room.registerNote")}</PhotoCaption>
				</div>
			</div>
		</section>
	);
}
