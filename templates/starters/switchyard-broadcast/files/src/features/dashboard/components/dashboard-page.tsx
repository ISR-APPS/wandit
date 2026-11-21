// Shows the active broadcast, channel checks, and the production rundown.
// The /app route renders it with sample records for a studio control room.
import {
	BroadcastIcon,
	CaretRightIcon,
	WaveSineIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

const stages = ["All cues", "On air", "Stand by", "Ready"] as const;
const cues = [
	{
		time: "18:00:00",
		title: "City Desk · Opening",
		studio: "Studio A",
		length: "00:45",
		status: "On air",
	},
	{
		time: "18:00:45",
		title: "Harbor report",
		studio: "Remote 04",
		length: "04:20",
		status: "Stand by",
	},
	{
		time: "18:05:05",
		title: "Weather wall",
		studio: "Studio B",
		length: "02:15",
		status: "Ready",
	},
	{
		time: "18:07:20",
		title: "Market report",
		studio: "Studio A",
		length: "03:30",
		status: "Ready",
	},
	{
		time: "18:10:50",
		title: "Local headlines",
		studio: "Studio A",
		length: "04:45",
		status: "Ready",
	},
];
const feeds = [
	{ channel: "PGM 01", input: "Studio A", status: "1080p50" },
	{ channel: "AUX 02", input: "Remote 04", status: "1080p50" },
	{ channel: "ISO 03", input: "Studio B", status: "1080p25" },
];

/** Uses the stage filter to display the same cues as the master rundown. */
export function DashboardPage() {
	const { t } = useT();
	const [stage, setStage] = useState<(typeof stages)[number]>("All cues");
	const visible = cues.filter(
		(cue) => stage === "All cues" || cue.status === stage,
	);
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="label-text text-primary text-sm">
						{t("dashboard.broadcastControlMondayEdition")}
					</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-tight sm:text-5xl">
						{t("dashboard.onAirControl")}
					</h1>
				</div>
				<Badge
					variant="outline"
					className="gap-2 border-success/60 text-success"
				>
					<BroadcastIcon />
					{t("dashboard.broadcastActive")}
				</Badge>
			</div>
			<div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
				<section
					className="relative flex min-h-58 flex-col justify-between overflow-hidden rounded-xl border border-primary/35 bg-card p-5 sm:p-7"
					aria-labelledby="live-feed"
				>
					<div
						className="absolute inset-0 opacity-80"
						aria-hidden="true"
						style={{
							background:
								"repeating-linear-gradient(0deg, transparent 0rem 1.5rem, var(--border) 1.5rem calc(1.5rem + 1px))",
						}}
					/>
					<div className="relative flex items-center justify-between gap-2">
						<Badge className="gap-2">
							<span className="size-1.5 rounded-full bg-primary-foreground" />
							{t("dashboard.programOut")}
						</Badge>
						<span className="font-mono text-muted-foreground text-sm">
							PGM 01 / SDI
						</span>
					</div>
					<div className="relative mt-12">
						<span className="font-mono text-primary text-sm">18:00:00</span>
						<h2
							id="live-feed"
							className="mt-2 font-semibold text-3xl sm:text-4xl"
						>
							{t("dashboard.cityDesk")}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("dashboard.studioAOpeningSequence")}
						</p>
					</div>
				</section>
				<section
					id="channels"
					className="scroll-mt-28 rounded-xl border bg-card p-5 sm:p-6"
					aria-labelledby="channel-title"
				>
					<h2
						id="channel-title"
						className="flex items-center gap-2 font-semibold text-lg"
					>
						<WaveSineIcon className="size-5 text-primary" />
						{t("dashboard.signalMonitor")}
					</h2>
					<ul className="mt-3 divide-y">
						{feeds.map((feed) => (
							<li
								key={feed.channel}
								className="flex items-center justify-between gap-2 py-3"
							>
								<span>
									<strong className="block font-mono text-xs">
										{feed.channel}
									</strong>
									<span className="text-muted-foreground text-sm">
										{feed.input}
									</span>
								</span>
								<span className="font-mono text-success text-xs">
									{feed.status}
								</span>
							</li>
						))}
					</ul>
				</section>
			</div>
			<section
				id="rundown"
				className="scroll-mt-28 overflow-hidden rounded-xl border bg-card"
				aria-labelledby="rundown-title"
			>
				<div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
					<div>
						<h2 id="rundown-title" className="font-semibold text-xl">
							{t("dashboard.masterRundown")}
						</h2>
						<p className="text-muted-foreground text-sm">
							{t("dashboard.cityDeskEveningNews")}
						</p>
					</div>
					<fieldset className="flex flex-wrap gap-1">
						<legend className="sr-only">
							{t("dashboard.filterCuesByStage")}
						</legend>
						{stages.map((choice) => (
							<Button
								key={choice}
								type="button"
								size="sm"
								variant={stage === choice ? "secondary" : "ghost"}
								aria-pressed={stage === choice}
								onClick={() => setStage(choice)}
							>
								{choice}
							</Button>
						))}
					</fieldset>
				</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("dashboard.timecode")}</TableHead>
							<TableHead>{t("dashboard.cue")}</TableHead>
							<TableHead>{t("dashboard.input")}</TableHead>
							<TableHead>{t("dashboard.length")}</TableHead>
							<TableHead>{t("dashboard.stage")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{visible.map((cue) => (
							<TableRow key={cue.time}>
								<TableCell className="font-mono text-primary">
									<span className="inline-flex items-center gap-1">
										<CaretRightIcon />
										{cue.time}
									</span>
								</TableCell>
								<TableCell className="font-medium">{cue.title}</TableCell>
								<TableCell>{cue.studio}</TableCell>
								<TableCell className="font-mono">{cue.length}</TableCell>
								<TableCell>
									<Badge
										variant={cue.status === "On air" ? "default" : "secondary"}
									>
										{cue.status}
									</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</section>
		</div>
	);
}
