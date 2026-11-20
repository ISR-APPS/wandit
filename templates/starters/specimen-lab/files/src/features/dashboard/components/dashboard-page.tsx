// Shows a laboratory intake register and bench status.
// The /app route renders it with sample accession records.
import { ArrowRightIcon, BarcodeIcon, FlaskIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Input } from "~/shared/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

const samples = [
	{
		id: "SP-4608",
		material: "EDTA plasma",
		bench: "Chemistry",
		intake: "08:37",
		status: "In analysis",
	},
	{
		id: "SP-4609",
		material: "Fungal culture",
		bench: "Microbiology",
		intake: "08:44",
		status: "Hold",
	},
	{
		id: "SP-4610",
		material: "Saline rinse",
		bench: "Water quality",
		intake: "08:52",
		status: "Received",
	},
	{
		id: "SP-4611",
		material: "Culture filtrate",
		bench: "Microbiology",
		intake: "09:02",
		status: "In analysis",
	},
	{
		id: "SP-4612",
		material: "Serum aliquot",
		bench: "Chemistry",
		intake: "09:16",
		status: "Released",
	},
	{
		id: "SP-4613",
		material: "Surface swab",
		bench: "Water quality",
		intake: "09:26",
		status: "Received",
	},
];

/** Searches the register across the barcode, material, bench, and current status. */
export function DashboardPage() {
	const { t } = useT();
	const [query, setQuery] = useState("");
	const search = query.trim().toLocaleLowerCase();
	const shown = samples.filter((sample) =>
		[sample.id, sample.material, sample.bench, sample.status].some((field) =>
			field.toLocaleLowerCase().includes(search),
		),
	);
	const intake = [
		{
			label: t("dashboard.received"),
			count: "43",
			note: t("dashboard.atTheIntakeDesk"),
		},
		{
			label: t("dashboard.inProcessing"),
			count: "27",
			note: t("dashboard.acrossThreeBenches"),
		},
		{
			label: t("dashboard.released"),
			count: "36",
			note: t("dashboard.clearedThisShift"),
		},
	];
	return (
		<div className="grid gap-6">
			<div className="flex items-end justify-between gap-4 border-b pb-5">
				<div>
					<p className="text-primary text-sm">
						{t("dashboard.northBuildingBenchB02")}
					</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-tight sm:text-5xl">
						{t("dashboard.sampleIntake")}
					</h1>
					<p className="mt-2 text-muted-foreground">
						{t("dashboard.intakeLogForTheMorningShift")}
					</p>
				</div>
				<FlaskIcon
					size="44"
					className="hidden shrink-0 text-primary sm:block"
				/>
			</div>
			<section
				className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-3"
				aria-label={t("dashboard.intakeTotals")}
			>
				{intake.map((step) => (
					<div
						key={step.label}
						className="grid gap-1 border-b px-5 py-4 last:border-b-0 sm:border-e sm:border-b-0 sm:last:border-e-0"
					>
						<span className="flex items-center justify-between gap-1 text-primary text-sm">
							{step.label}
							<ArrowRightIcon className="rtl:rotate-180" />
						</span>
						<strong className="font-numeric font-semibold text-4xl">
							{step.count}
						</strong>
						<span className="text-muted-foreground text-sm">{step.note}</span>
					</div>
				))}
			</section>
			<section
				id="register"
				className="scroll-mt-32 overflow-hidden rounded-xl border bg-card"
				aria-labelledby="register-title"
			>
				<div className="flex flex-wrap items-end justify-between gap-4 p-5">
					<div>
						<h2
							id="register-title"
							className="flex items-center gap-2 font-semibold text-xl"
						>
							<BarcodeIcon className="text-primary" />
							{t("dashboard.accessionRegister")}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("dashboard.mostRecentSamples")}
						</p>
					</div>
					<label htmlFor="sample-search" className="grid gap-1 text-sm">
						{t("dashboard.findASample")}
						<Input
							id="sample-search"
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("dashboard.barcodeMaterialOrBench")}
							className="sm:w-57"
						/>
					</label>
				</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("dashboard.barcode")}</TableHead>
							<TableHead>{t("dashboard.material")}</TableHead>
							<TableHead>{t("dashboard.bench")}</TableHead>
							<TableHead>{t("dashboard.receivedAt")}</TableHead>
							<TableHead>{t("dashboard.status")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{shown.map((sample) => (
							<TableRow key={sample.id}>
								<TableCell className="font-mono text-primary">
									{sample.id}
								</TableCell>
								<TableCell className="font-medium">{sample.material}</TableCell>
								<TableCell>{sample.bench}</TableCell>
								<TableCell className="font-numeric">{sample.intake}</TableCell>
								<TableCell>
									<Badge
										variant={sample.status === "Hold" ? "outline" : "secondary"}
									>
										{sample.status}
									</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{shown.length === 0 && (
					<p
						role="status"
						className="border-t p-5 text-muted-foreground text-sm"
					>
						{t("dashboard.noSamplesMatchThisSearch")}
					</p>
				)}
			</section>
			<section
				id="benches"
				className="scroll-mt-32 rounded-xl border bg-muted p-5"
				aria-labelledby="bench-title"
			>
				<h2 id="bench-title" className="font-semibold text-xl">
					{t("dashboard.processingBenches")}
				</h2>
				<dl className="mt-4 flex flex-wrap gap-5 sm:gap-10">
					<div>
						<dt>{t("dashboard.chemistry")}</dt>
						<dd className="text-muted-foreground text-sm">
							{t("dashboard.chemistrySampleCount")}
						</dd>
					</div>
					<div>
						<dt>{t("dashboard.microbiology")}</dt>
						<dd className="text-muted-foreground text-sm">
							{t("dashboard.microbiologySampleCount")}
						</dd>
					</div>
					<div>
						<dt>{t("dashboard.waterQuality")}</dt>
						<dd className="text-muted-foreground text-sm">
							{t("dashboard.waterQualitySampleCount")}
						</dd>
					</div>
				</dl>
			</section>
		</div>
	);
}
