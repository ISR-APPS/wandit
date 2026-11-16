// The district sheet next to the map: the figures and the view of the agency for the pressed pin.
// DistrictsSection renders it. With no pin pressed it shows the totals of the agency.
// Its button sets the register filter to the district and scrolls to the register.
import { ArrowDownIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	DISTRICTS_COVERED,
	type District,
	type DistrictId,
	HOMES_AT_AGENCY,
} from "../lib/districts";
import { formatCount, formatEuros } from "../lib/format";
import { DISPLAY, FIGURES, LABEL } from "../lib/type-styles";

type DistrictSheetProps = {
	/** The district of the pressed pin, or undefined before the first press. */
	district: District | undefined;
	/** Filters the register to this district and moves the page to it. */
	onShowHomes: (id: DistrictId) => void;
};

/** A framed card. aria-live reads the new district when a pin changes it. */
export function DistrictSheet({ district, onShowHomes }: DistrictSheetProps) {
	const { t, locale } = useT();
	const rows =
		district === undefined
			? [
					{
						label: t("districts.covered"),
						value: formatCount(DISTRICTS_COVERED, locale),
					},
					{
						label: t("districts.atAgency"),
						value: formatCount(HOMES_AT_AGENCY, locale),
					},
				]
			: [
					{
						label: t("districts.available"),
						value: formatCount(district.homesAvailable, locale),
					},
					{
						label: t("districts.average"),
						value: formatEuros(district.averagePerSqm, locale),
						unit: t("districts.perSqm"),
					},
				];

	return (
		<aside
			aria-live="polite"
			aria-label={t("districts.cardTitle")}
			// From 1024px the grid stretches the sheet to the map height; the quote and the button then sit at its foot.
			className="rn-corners relative flex flex-col border border-foreground bg-background"
		>
			<span aria-hidden="true" className="rn-corners-end" />
			<div
				className={cn(
					LABEL,
					"flex items-center justify-between border-foreground/12 border-b px-4 py-2.5 text-[10px] tracking-[0.2em]",
				)}
			>
				<span>{t("districts.cardTitle")}</span>
				<span>{district === undefined ? "—" : t(district.nameKey)}</span>
			</div>
			<div
				key={district?.id ?? "none"}
				className="rn-pop flex flex-1 flex-col px-4 pt-4.5 pb-5"
			>
				<h3
					className={cn(
						DISPLAY,
						"mb-3 text-[clamp(32px,3vw,46px)] leading-[0.92]",
					)}
				>
					{district === undefined
						? t("districts.pickPin")
						: t(district.nameKey)}
				</h3>
				{rows.map((row) => (
					<div
						key={row.label}
						className="flex items-baseline justify-between gap-4 border-foreground/12 border-t py-2.25"
					>
						<span
							className={cn(LABEL, "text-[10px] tracking-[0.16em] opacity-70")}
						>
							{row.label}
						</span>
						<b className={cn(DISPLAY, FIGURES, "text-[22px] leading-none")}>
							{row.value}
							{row.unit !== undefined && (
								<em
									className={cn(
										LABEL,
										"ms-1 text-[10px] normal-case not-italic opacity-60",
									)}
								>
									{row.unit}
								</em>
							)}
						</b>
					</div>
				))}
				<blockquote className="mt-4.5 mb-4.5 border-primary border-s-4 py-1 ps-3.5 text-[15px] leading-normal lg:mt-auto">
					{district === undefined
						? t("districts.defaultQuote")
						: t(district.quoteKey)}
					<small
						className={cn(
							LABEL,
							"mt-2 block text-[10px] tracking-[0.16em] opacity-60",
						)}
					>
						{t("districts.quoteSource")}
					</small>
				</blockquote>
				{district !== undefined && (
					<button
						type="button"
						onClick={() => onShowHomes(district.id)}
						className={cn(
							LABEL,
							"inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-[12px] text-primary-foreground tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background",
						)}
					>
						{t("districts.showHomes")}
						<ArrowDownIcon className="size-3.5" />
					</button>
				)}
			</div>
		</aside>
	);
}
