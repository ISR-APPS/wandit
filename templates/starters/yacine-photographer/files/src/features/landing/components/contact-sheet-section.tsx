// Section 03: one contact sheet with its roll notes. It shows the edit: thirty-six frames, three kept.
// landing-page.tsx renders it. It reads SHEET_ROWS from lib/content.ts and the "sheet" group of messages.ts.
// The count of grease marks, the "Frames kept" value, and the note under the title state the same number.
import { useT } from "~/shared/i18n";
import { SHEET_ROWS } from "../lib/content";
import { H2, KICKER, LABEL, META, NOTE, WRAP } from "../lib/styles";
import { CutGroup } from "./cut-group";
import { GreaseMark } from "./grease-mark";
import { PhotoFrame } from "./photo-frame";

/** The roll notes rise beside the title from 900px, so the sheet runs the full width of the container. */
export function ContactSheetSection() {
	const { t } = useT();
	const margin = [
		{ label: t("sheet.rollLabel"), value: t("sheet.rollValue") },
		{ label: t("sheet.developmentLabel"), value: t("sheet.developmentValue") },
		{ label: t("sheet.keptLabel"), value: t("sheet.keptValue") },
		// The pencil note is the long one: on a phone it takes the full row.
		{
			label: t("sheet.pencilLabel"),
			value: t("sheet.pencilValue"),
			isLong: true,
		},
		{ label: t("sheet.statusLabel"), value: t("sheet.statusValue") },
	];
	return (
		<section
			id="sheet"
			aria-labelledby="sheet-title"
			className="py-(--yr-section)"
		>
			<CutGroup
				className={`${WRAP} grid items-start gap-x-[clamp(20px,3vw,46px)] min-[900px]:grid-cols-[minmax(0,1fr)_clamp(220px,24vw,310px)]`}
			>
				<div className="flex flex-col gap-[18px] self-stretch pb-[clamp(2rem,4vh,3.2rem)]">
					<div className="yr-cut">
						<p className={KICKER}>{t("sheet.kicker")}</p>
						<h2 id="sheet-title" className={`${H2} mt-3.5`}>
							<span className="block">{t("sheet.titleLine1")}</span>
							<span className="block">{t("sheet.titleLine2")}</span>
						</h2>
					</div>
					<p className={`${NOTE} yr-cut max-w-[52ch] [--cut:1]`}>
						{t("sheet.note")}
					</p>
					{/* mt-auto sets the legend on the last line of the roll notes, just above the sheet. */}
					<p
						className={`${META} yr-cut mt-auto flex flex-wrap gap-x-[18px] gap-y-1 border-foreground/15 border-t pt-3 [--cut:2] max-[899px]:mt-1`}
					>
						<span>{t("sheet.legendFrames")}</span>
						<span>{t("sheet.legendShown")}</span>
					</p>
				</div>

				<dl className="yr-cut grid gap-y-3.5 [--cut:3] max-[899px]:order-last max-[899px]:mt-[clamp(1.6rem,3vh,2.4rem)] max-[899px]:grid-cols-2 max-[899px]:gap-x-5 min-[900px]:pb-[clamp(2rem,4vh,3.2rem)]">
					{margin.map((fact) => (
						<div
							key={fact.label}
							className={fact.isLong ? "max-[899px]:col-span-2" : undefined}
						>
							<dt className={LABEL}>{fact.label}</dt>
							<dd className="mt-1 text-[0.95rem] leading-[1.5]">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>

				<div className="yr-cut border border-foreground/15 bg-canvas p-[clamp(12px,1.6vw,22px)] [--cut:4] min-[900px]:col-span-2">
					{SHEET_ROWS.map((row) => (
						<div
							key={row.id}
							className="yr-band-x relative mt-[clamp(10px,1.4vw,18px)] grid grid-cols-2 gap-[5px] py-[18px] first:mt-0 min-[900px]:grid-cols-4"
						>
							{row.frames.map((frame) => (
								<div key={frame.number} className="relative">
									<PhotoFrame
										photo={frame.photo}
										number={frame.number}
										numberPlace="base"
										exif="short"
										className="aspect-[3/2]"
									/>
									{frame.mark !== undefined && (
										<>
											<GreaseMark variant={frame.mark} />
											<span className="yr-mono absolute -end-1 -top-[9px] z-[5] bg-foreground px-[5px] py-0.5 text-[0.54rem] text-background uppercase leading-[1.4] tracking-[0.12em]">
												{t("sheet.keepTag")}
											</span>
										</>
									)}
								</div>
							))}
						</div>
					))}
				</div>
			</CutGroup>
		</section>
	);
}
