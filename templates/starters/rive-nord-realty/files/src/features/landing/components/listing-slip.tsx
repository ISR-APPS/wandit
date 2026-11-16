// The listing slip of the sell section: the seller picks a type of home and a district, then emails the slip.
// SellSection renders it. Nothing posts to a server: the button is a mailto link that carries the two choices.
// STARTER.md says where a real form with a table goes. The texts live in the `sell` group of messages.ts.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { type TranslationKey, useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DISTRICTS } from "../lib/districts";
import { DISPLAY, FIGURES, LABEL } from "../lib/type-styles";
import { ChoiceGroup } from "./choice-group";

const TYPE_KEYS: readonly TranslationKey[] = [
	"sell.typeOne",
	"sell.typeTwo",
	"sell.typeThree",
	"sell.typeFour",
	"sell.typeOther",
];

const DISTRICT_KEYS: readonly TranslationKey[] = [
	...DISTRICTS.map((district) => district.nameKey),
	"sell.elsewhere",
];

/** Framed slip with crop marks. The summary line and the mail link follow the two choices. */
export function ListingSlip() {
	const { t } = useT();
	const [typeKey, setTypeKey] = useState<TranslationKey>("sell.typeTwo");
	// The slip opens on Old Town, the district of the agency counter.
	const [districtKey, setDistrictKey] =
		useState<TranslationKey>("districts.oldTown");
	const summary = `${t(typeKey)} — ${t(districtKey)}`;
	const body = `${t("sell.mailBody")}\n\n${t("sell.mailHome")}: ${summary}\n${t("sell.mailPhone")}: `;
	const mailHref = `${t("site.emailHref")}?subject=${encodeURIComponent(t("sell.mailSubject"))}&body=${encodeURIComponent(body)}`;

	return (
		<div className="rn-corners relative border border-foreground bg-background">
			<span aria-hidden="true" className="rn-corners-end" />
			<div className="flex items-center justify-between border-foreground border-b px-4 py-3">
				<h3 className={cn(LABEL, "text-[10px] tracking-[0.2em]")}>
					{t("sell.slipTitle")}
				</h3>
				<b
					className={cn(
						DISPLAY,
						FIGURES,
						"text-[16px] leading-none tracking-[0.06em]",
					)}
				>
					{t("sell.slipNumber")}
				</b>
			</div>
			<ChoiceGroup
				legend={t("sell.typeLabel")}
				name="slip-type"
				options={TYPE_KEYS}
				value={typeKey}
				onChange={setTypeKey}
			/>
			<ChoiceGroup
				legend={t("sell.districtLabel")}
				name="slip-district"
				options={DISTRICT_KEYS}
				value={districtKey}
				onChange={setDistrictKey}
			/>
			<div className="border-foreground/12 border-b px-4 pt-3 pb-3.5">
				<p className={cn(LABEL, "mb-1.5 text-[10px] opacity-75")}>
					{t("sell.summaryLabel")}
				</p>
				<p
					aria-live="polite"
					className={cn(
						DISPLAY,
						"text-[clamp(26px,2.6vw,34px)] leading-[0.92]",
					)}
				>
					{summary}
				</p>
			</div>
			<a
				href={mailHref}
				className={cn(
					DISPLAY,
					"flex min-h-15 items-center justify-center gap-3 bg-primary px-4 py-5 text-[clamp(20px,2vw,26px)] text-primary-foreground leading-none tracking-[0.08em] transition-colors hover:bg-foreground hover:text-background",
				)}
			>
				{t("sell.send")}
				<ArrowRightIcon className="size-5 rtl:rotate-180" />
			</a>
			<p className="px-4 pt-2.5 pb-3 text-[12px] leading-normal opacity-70">
				{t("sell.orCall")}{" "}
				<a
					href={t("site.phoneHref")}
					className={cn(FIGURES, "font-bold underline")}
				>
					{t("site.phoneDisplay")}
				</a>
				. {t("sell.slipNote")}
			</p>
		</div>
	);
}
