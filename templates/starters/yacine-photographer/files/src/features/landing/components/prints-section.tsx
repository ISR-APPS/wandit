// Section 05: the prints for sale and the prices of the commissions.
// landing-page.tsx renders it. It reads PRINTS from lib/content.ts and the "prints" group of messages.ts.
// The three plates have unequal widths and one base line, so their tops make a staircase.
import { useT } from "~/shared/i18n";
import { PRINTS } from "../lib/content";
import { KICKER, LABEL, NOTE, WRAP } from "../lib/styles";
import { CutGroup } from "./cut-group";
import { PrintPlate } from "./print-plate";

/** The price list sits beside the plates from 941px, and above them below. */
export function PrintsSection() {
	const { t } = useT();
	const rates = [
		{ label: t("prints.weddingLabel"), price: t("prints.weddingPrice") },
		{ label: t("prints.portraitLabel"), price: t("prints.portraitPrice") },
		{ label: t("prints.editorialLabel"), price: t("prints.editorialPrice") },
	];
	return (
		<section
			id="prints"
			aria-labelledby="prints-title"
			className="border-foreground/15 border-t py-(--yr-section)"
		>
			<CutGroup
				className={`${WRAP} grid items-start gap-[clamp(24px,3.6vw,56px)] min-[941px]:grid-cols-[clamp(280px,31vw,440px)_minmax(0,1fr)]`}
			>
				<div className="yr-cut">
					<p className={KICKER}>{t("prints.kicker")}</p>
					<h2
						id="prints-title"
						className="mt-3.5 font-display font-extrabold text-[clamp(1.5rem,2.2vw,2rem)] leading-[1.04] tracking-[-0.028em]"
					>
						<span className="block">{t("prints.titleLine1")}</span>
						<span className="block">{t("prints.titleLine2")}</span>
					</h2>
					<p className={`${NOTE} mt-[22px] max-w-[60ch]`}>{t("prints.note")}</p>
					<dl className="mt-[22px] border-foreground/15 border-t">
						{rates.map((rate) => (
							<div
								key={rate.label}
								className="flex items-baseline justify-between gap-3.5 border-foreground/15 border-b py-[11px]"
							>
								<dt className={LABEL}>{rate.label}</dt>
								<dd className="font-bold font-display text-[0.98rem] tracking-[-0.01em]">
									{rate.price}
								</dd>
							</div>
						))}
					</dl>
				</div>

				{/* A phone has two columns, and the last plate takes a full row under them, as the source page does. */}
				<div className="yr-cut grid grid-cols-2 items-end gap-[clamp(12px,1.8vw,26px)] [--cut:1] min-[641px]:grid-cols-[1.42fr_1.1fr_1fr]">
					{PRINTS.map((print) => (
						<PrintPlate key={print.photo} print={print} />
					))}
				</div>
			</CutGroup>
		</section>
	);
}
