// Section 01, the register: district chips, the ruled list of homes, the rental note, and the window.
// LandingPage renders it and owns the district filter, so the district sheet of the map can set it too.
// It reads lib/listings.ts and lib/districts.ts, and renders ListingRow and ShopWindow.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useReveal } from "../hooks/use-reveal";
import { DISTRICTS, type DistrictId } from "../lib/districts";
import { LISTINGS } from "../lib/listings";
import { FIGURES, LABEL, WRAP } from "../lib/type-styles";
import { ListingRow } from "./listing-row";
import { SectionHead } from "./section-head";
import { ShopWindow } from "./shop-window";

/** The value of the register filter: one district, or every home. */
export type RegisterFilter = DistrictId | "all";

type RegisterSectionProps = {
	filter: RegisterFilter;
	onFilterChange: (filter: RegisterFilter) => void;
};

/** The board of homes. The first visible home fills the window until the visitor points at another row. */
export function RegisterSection({
	filter,
	onFilterChange,
}: RegisterSectionProps) {
	const { t } = useT();
	const [activeRef, setActiveRef] = useState(LISTINGS[0]?.ref ?? "");
	// A filter change bumps the key of the list, so the rows that stay play their entrance again.
	const [listVersion, setListVersion] = useState(0);
	const revealRef = useReveal<HTMLDivElement>();

	const shown = LISTINGS.filter(
		(listing) => filter === "all" || listing.district === filter,
	);
	const active = shown.find((listing) => listing.ref === activeRef) ?? shown[0];
	const chips: { id: RegisterFilter; label: string }[] = [
		{ id: "all", label: t("register.all") },
		...DISTRICTS.map((district) => ({
			id: district.id,
			label: t(district.nameKey),
		})),
	];
	const askHrefOf = (ref: string) =>
		`${t("site.emailHref")}?subject=${encodeURIComponent(`${t("register.askAbout")} ${ref}`)}`;

	function changeFilter(next: RegisterFilter) {
		onFilterChange(next);
		setListVersion((version) => version + 1);
	}

	return (
		<section
			id="register"
			aria-labelledby="register-title"
			className={cn(WRAP, "py-[clamp(56px,8vw,110px)]")}
		>
			<SectionHead
				tag={t("register.tag")}
				title={t("register.title")}
				note={t("register.note")}
				titleId="register-title"
			/>
			<div
				ref={revealRef}
				className="grid items-start gap-[clamp(24px,3vw,48px)] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]"
			>
				<div>
					<fieldset className="mb-2.5 flex flex-wrap gap-2">
						<legend className="sr-only">{t("register.filterLabel")}</legend>
						{chips.map((chip) => (
							<button
								key={chip.id}
								type="button"
								aria-pressed={filter === chip.id}
								onClick={() => changeFilter(chip.id)}
								className={cn(
									LABEL,
									"min-h-11 border px-3.5 text-[11px] tracking-[0.14em] transition-colors",
									filter === chip.id
										? "border-primary bg-primary text-primary-foreground"
										: "border-foreground bg-background hover:bg-secondary",
								)}
							>
								{chip.label}
							</button>
						))}
					</fieldset>
					<p
						aria-live="polite"
						className={cn(
							LABEL,
							FIGURES,
							"mt-2.5 mb-1 text-[11px] tracking-[0.16em] opacity-70",
						)}
					>
						{shown.length}{" "}
						{shown.length === 1
							? t("register.countOne")
							: t("register.countMany")}
					</p>
					{shown.length === 0 ? (
						<p className="border-foreground/12 border-y py-8 text-[15px]">
							{t("register.empty")}
						</p>
					) : (
						<ul
							key={listVersion}
							className={cn(
								"rn-stagger mt-4",
								listVersion > 0 && "rn-refiltered",
							)}
						>
							{shown.map((listing) => (
								<ListingRow
									key={listing.ref}
									listing={listing}
									isActive={listing.ref === active?.ref}
									onSelect={setActiveRef}
									askHref={askHrefOf(listing.ref)}
								/>
							))}
						</ul>
					)}
					<p className="mt-0 max-w-[70ch] pt-4 text-[14px] leading-relaxed">
						<b className="font-bold">{t("register.rentLabel")}</b>{" "}
						{t("register.rentBody")}
					</p>
				</div>
				{active !== undefined && (
					<ShopWindow listing={active} askHref={askHrefOf(active.ref)} />
				)}
			</div>
		</section>
	);
}
