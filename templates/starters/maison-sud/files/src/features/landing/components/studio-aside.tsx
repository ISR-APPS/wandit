// The studio column of the appointment section: the address, the hours, the samples, and the fee schedule.
// ContactSection renders it at 5 of 12. The fees are a ruled table with a plain note, never a pricing card.
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MICRO_CAPS_TIGHT, RULE_LABEL } from "../lib/type-styles";
import { PlanGlyph, type PlanGlyphName } from "./plan-glyph";

// The facts of the studio. A fact has one or two lines.
const FACTS: readonly {
	glyph: PlanGlyphName;
	labelKey: TranslationKey;
	lineKeys: readonly TranslationKey[];
}[] = [
	{
		glyph: "plan",
		labelKey: "contact.addressLabel",
		lineKeys: ["contact.addressLine1", "contact.addressLine2"],
	},
	{
		glyph: "window",
		labelKey: "contact.hoursLabel",
		lineKeys: ["contact.hoursLine1", "contact.hoursLine2"],
	},
	{
		glyph: "stone",
		labelKey: "contact.samplesLabel",
		lineKeys: ["contact.samplesLine"],
	},
];

// The fee schedule, in Algerian dinars (DA). The amounts are texts, because one of them is a share of the works.
const FEES: readonly { nameKey: TranslationKey; amountKey: TranslationKey }[] =
	[
		{ nameKey: "contact.fee1Name", amountKey: "contact.fee1Amount" },
		{ nameKey: "contact.fee2Name", amountKey: "contact.fee2Amount" },
		{ nameKey: "contact.fee3Name", amountKey: "contact.fee3Amount" },
		{ nameKey: "contact.fee4Name", amountKey: "contact.fee4Amount" },
	];

type StudioAsideProps = {
	/** Grid placement in the appointment section. */
	className?: string;
};

/** Facts and fees of the studio. The note under the table says that the rates do not change with the day. */
export function StudioAside({ className }: StudioAsideProps) {
	const { t } = useT();
	return (
		<aside className={className}>
			<p data-reveal="lift" className={RULE_LABEL}>
				{t("contact.studioLabel")}
			</p>
			<ul data-reveal="lift" className="mt-5">
				{FACTS.map((fact) => (
					<li
						key={fact.labelKey}
						className="flex items-start gap-3 border-foreground/10 border-t py-3.5 text-[0.95rem] leading-relaxed"
					>
						<PlanGlyph name={fact.glyph} className="mt-0.5" />
						<span>
							<span className={cn(MICRO_CAPS_TIGHT, "mb-1 block")}>
								{t(fact.labelKey)}
							</span>
							{fact.lineKeys.map((lineKey) => (
								<span key={lineKey} className="block">
									{t(lineKey)}
								</span>
							))}
						</span>
					</li>
				))}
			</ul>
			<table
				data-reveal="lift"
				className="mt-[clamp(1.6rem,3vw,2.4rem)] w-full border-collapse"
			>
				<caption className="sr-only">{t("contact.feesCaption")}</caption>
				<thead>
					<tr>
						<th
							scope="col"
							className={cn(
								MICRO_CAPS_TIGHT,
								"border-foreground/18 border-b pb-2.5 text-start",
							)}
						>
							{t("contact.feesHead")}
						</th>
						<th
							scope="col"
							className={cn(
								MICRO_CAPS_TIGHT,
								"border-foreground/18 border-b pb-2.5 text-end",
							)}
						>
							{t("contact.feesAmount")}
						</th>
					</tr>
				</thead>
				<tbody>
					{FEES.map((fee) => (
						<tr key={fee.nameKey}>
							<td className="border-foreground/10 border-b py-3 pe-4 align-top text-[0.94rem]">
								{t(fee.nameKey)}
							</td>
							<td className="ms-serif whitespace-nowrap border-foreground/10 border-b py-3 text-end align-top text-[1.06rem]">
								{t(fee.amountKey)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="ms-warm-rule mt-4 max-w-[46ch] ps-3.5 text-[0.86rem] text-muted-foreground leading-[1.6]">
				{t("contact.feesNote")}
			</p>
		</aside>
	);
}
