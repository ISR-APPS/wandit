// Shows the museum object register, locations, and loans.
// The /app route renders it with sample collections.
import { ArchiveIcon, HandshakeIcon, MapPinIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";

const media = ["All media", "Ceramic", "Textile", "Photograph"] as const;
const objects = [
	{
		id: "FC.1974.28",
		name: "Slipware bowl",
		period: "c. 1770",
		medium: "Ceramic",
		place: "Gallery 4 · Case B",
		holder: "On display",
	},
	{
		id: "FC.1989.06",
		name: "North gallery sampler",
		period: "1913",
		medium: "Textile",
		place: "Study room · Drawer 6",
		holder: "In storage",
	},
	{
		id: "FC.2006.42",
		name: "Ferry terminal at dawn",
		period: "1968",
		medium: "Photograph",
		place: "Lakeside Museum",
		holder: "Out on loan",
	},
	{
		id: "FC.2011.14",
		name: "Blue glaze water vessel",
		period: "c. 1820",
		medium: "Ceramic",
		place: "Gallery 2 · Case F",
		holder: "On display",
	},
	{
		id: "FC.2020.05",
		name: "Marsh study, contact print",
		period: "1975",
		medium: "Photograph",
		place: "Print room · Box 13",
		holder: "In storage",
	},
];

/** Filters the object register by medium. The loan register stays visible. */
export function DashboardPage() {
	const { t } = useT();
	const [medium, setMedium] = useState<(typeof media)[number]>("All media");
	const visible = objects.filter(
		(item) => medium === "All media" || item.medium === medium,
	);
	return (
		<div className="mx-auto grid max-w-6xl gap-7">
			<div className="grid gap-4 border-y py-5 sm:grid-cols-[1fr_auto] sm:gap-8">
				<div>
					<p className="text-muted-foreground text-sm">
						{t("dashboard.collectionsOffice2026Register")}
					</p>
					<h1 className="mt-3 font-display text-4xl sm:text-6xl">
						{t("dashboard.theCollections")}
					</h1>
					<p className="mt-2 text-muted-foreground">
						{t("dashboard.objectsLocationsAndMovementsAcrossTheMuseum")}
					</p>
				</div>
				<div className="flex items-center gap-3 self-end text-primary">
					<ArchiveIcon size="28" />
					<strong className="font-numeric text-3xl">1,864</strong>
					<span className="text-muted-foreground text-xs">
						{t("dashboard.objectsInCare")}
					</span>
				</div>
			</div>
			<section
				id="objects"
				aria-labelledby="object-title"
				className="scroll-mt-10"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="object-title" className="font-display text-2xl">
						{t("dashboard.objectRegister")}
					</h2>
					<div className="flex flex-wrap gap-1">
						{media.map((choice) => (
							<Button
								key={choice}
								type="button"
								variant={medium === choice ? "secondary" : "ghost"}
								aria-pressed={medium === choice}
								size="sm"
								onClick={() => setMedium(choice)}
							>
								{choice}
							</Button>
						))}
					</div>
				</div>
				<ul className="mt-4 divide-y border-y">
					{visible.map((item) => (
						<li
							key={item.id}
							className="grid grid-cols-[1fr_auto] items-center gap-2 py-3 sm:grid-cols-[6.5rem_1fr_10rem_6rem] sm:gap-4"
						>
							<span className="font-numeric text-muted-foreground text-xs">
								{item.id}
							</span>
							<span className="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
								<strong className="block font-display font-medium">
									{item.name}
								</strong>
								<span className="text-muted-foreground text-xs">
									{item.medium} · {item.period}
								</span>
							</span>
							<span className="text-muted-foreground text-sm">
								<MapPinIcon className="me-1 inline" />
								{item.place}
							</span>
							<Badge variant="outline" className="w-fit">
								{item.holder}
							</Badge>
						</li>
					))}
				</ul>
			</section>
			<section
				id="loans"
				aria-labelledby="loan-title"
				className="scroll-mt-10 rounded-xl border bg-card p-5 sm:p-6"
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 id="loan-title" className="font-display text-2xl">
							{t("dashboard.loanRegister")}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("dashboard.nextScheduledReturn")}
						</p>
					</div>
					<HandshakeIcon size="26" className="text-primary" />
				</div>
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
					<div>
						<strong className="block">
							{t("dashboard.ferryTerminalAtDawn")}
						</strong>
						<span className="text-muted-foreground text-sm">
							{t("dashboard.lakesideMuseumWorksOnPaper")}
						</span>
					</div>
					<span className="font-numeric text-primary">
						{t("dashboard.nextLoanReturnDate")}
					</span>
				</div>
			</section>
		</div>
	);
}
