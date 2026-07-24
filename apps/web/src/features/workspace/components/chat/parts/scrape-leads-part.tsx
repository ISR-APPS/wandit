// In-thread card for a scrape_leads call. The scrape runs in a background
// task; this part polls the attempt endpoint and renders the live progress
// checklist (per the lead-scrape mockup), then the finished-workbook card
// with a preview table and the Download .xlsx action. Reload-safe: the card
// rebuilds itself entirely from the persisted attemptId + polled state.
// Chrome strings hardcoded English this pass, same rule as the tray files.

import type { LeadScrapeAttempt, LeadScrapeStage } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	Check,
	Code,
	Download,
	FileSpreadsheet,
} from "lucide-react";
import { useLeadScrapeAttemptQuery } from "../../../api/lead-scrapes.queries";
import { leadScrapeDownloadUrl } from "../../../api/lead-scrapes.services";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type ScrapeLeadsToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-scrape_leads" }
>;

const SOURCE_LABELS: Record<string, string> = {
	"google-maps": "Google Maps",
};

export function ScrapeLeadsPart({ part }: { part: ScrapeLeadsToolPart }) {
	// The search brief streams in first, then the tool executes server-side.
	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<WorkingLine
				text={
					part.state === "input-streaming"
						? "Working on your lead search…"
						: "Queueing the scrape…"
				}
			/>
		);
	}

	if (part.state === "output-error") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker="Lead scrape failed to start"
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{part.errorText}
				</p>
			</div>
		);
	}

	if (part.state !== "output-available") return null;

	if (part.output.status === "queued" && part.output.attemptId) {
		return (
			<LeadScrapeCard
				attemptId={part.output.attemptId}
				fallbackQuery={part.input.query}
				fallbackLocation={part.input.location ?? null}
			/>
		);
	}

	// "unavailable" — the server is missing provider/R2/Trigger credentials;
	// relay the tool's honest message instead of pretending a scrape runs.
	return (
		<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
			{part.output.message}
		</p>
	);
}

/** Polls the attempt and picks the progress / result / failed presentation. */
function LeadScrapeCard({
	attemptId,
	fallbackQuery,
	fallbackLocation,
}: {
	attemptId: string;
	fallbackQuery: string;
	fallbackLocation: string | null;
}) {
	const { data: attempt, error } = useLeadScrapeAttemptQuery(attemptId);

	if (error) {
		return (
			<p className="text-[13px] text-muted-foreground leading-[1.5]">
				Couldn't load the scrape status — reopen this chat to retry.
			</p>
		);
	}

	if (attempt?.status === "failed") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker="Lead scrape failed"
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{attempt.error ?? "The scrape stopped before finishing."}
				</p>
			</div>
		);
	}

	if (attempt?.status === "succeeded") {
		return <LeadScrapeResultCard attempt={attempt} />;
	}

	// queued / running / first poll still in flight.
	return (
		<LeadScrapeProgressCard
			attempt={attempt}
			fallbackQuery={fallbackQuery}
			fallbackLocation={fallbackLocation}
		/>
	);
}

/* ---------- progress card ---------- */

// Checklist rows 2..5 map onto the pipeline stages in order; row 1 (the
// parsed brief) is done the moment the attempt exists.
const STAGE_ROWS: Array<{
	stage: LeadScrapeStage;
	active: string;
	done: string;
}> = [
	{
		active: "Searching Google Maps…",
		done: "Searched Google Maps",
		stage: "searching",
	},
	{
		active: "Extracting contacts",
		done: "Extracted contacts",
		stage: "extracting",
	},
	{
		active: "Verifying emails & de-duplicating",
		done: "Verified emails & de-duplicated",
		stage: "verifying",
	},
	{
		active: "Exporting to .xlsx",
		done: "Exported to .xlsx",
		stage: "exporting",
	},
];

const STAGE_ORDER: LeadScrapeStage[] = [
	"queued",
	"searching",
	"extracting",
	"verifying",
	"exporting",
];

function LeadScrapeProgressCard({
	attempt,
	fallbackQuery,
	fallbackLocation,
}: {
	attempt: LeadScrapeAttempt | undefined;
	fallbackQuery: string;
	fallbackLocation: string | null;
}) {
	const query = attempt?.query || fallbackQuery;
	const location = attempt?.location ?? fallbackLocation;
	const progress = attempt?.progress ?? 0;
	const sources = attempt?.sources.length ? attempt.sources : ["google-maps"];
	// While the row still says "queued" the search is about to start — show
	// its row as active rather than an all-pending dead card.
	const stageIndex = Math.max(
		1,
		STAGE_ORDER.indexOf(attempt?.stage ?? "queued"),
	);
	const foundCount = attempt?.foundCount ?? 0;

	return (
		<div className="rounded-xl border border-border bg-background p-[15px]">
			<div className="mb-2.5 flex items-center justify-between">
				<span className="font-medium text-foreground text-sm">
					Scraping leads
				</span>
				<span className="font-mono text-ember-text text-xs">{progress}%</span>
			</div>
			<div className="mb-[13px] h-1 overflow-hidden rounded-full bg-border">
				<div
					className="h-full rounded-full bg-gradient-ember transition-[width] duration-700"
					style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
				/>
			</div>
			<div className="mb-3 flex flex-wrap gap-[7px]">
				{sources.map((source) => (
					<span
						key={source}
						className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px] text-muted-foreground"
					>
						<span aria-hidden className="size-1.5 rounded-full bg-success" />
						{SOURCE_LABELS[source] ?? source}
					</span>
				))}
			</div>
			<div className="flex flex-col gap-[9px] text-[13.5px]">
				<StepRow state="done">
					<span>
						Parsed the brief
						<span className="text-muted-foreground">
							{" "}
							· {query}
							{location ? ` · ${location}` : ""}
						</span>
					</span>
				</StepRow>
				{STAGE_ROWS.map((row, index) => {
					// Row index within the stage pipeline: searching is 1.
					const rowStage = index + 1;
					const state =
						stageIndex > rowStage
							? "done"
							: stageIndex === rowStage
								? "active"
								: "pending";

					return (
						<StepRow
							key={row.stage}
							state={state}
							badge={
								row.stage === "extracting" && foundCount > 0 ? (
									<span className="ms-auto shrink-0 rounded-full border border-primary/35 bg-primary/5 px-2 py-0.5 font-mono text-[11px] text-ember-text">
										{foundCount} found
									</span>
								) : undefined
							}
						>
							{state === "done" ? row.done : row.active}
						</StepRow>
					);
				})}
			</div>
			<div className="mt-[11px] inline-flex items-center gap-[7px] rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
				<Code className="size-3 text-primary" aria-hidden />
				tool · scrape_leads
			</div>
		</div>
	);
}

function StepRow({
	state,
	badge,
	children,
}: {
	state: "done" | "active" | "pending";
	badge?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2.5",
				state === "done" && "text-muted-foreground",
				state === "active" && "font-medium text-foreground",
				state === "pending" && "text-faint",
			)}
		>
			{state === "done" ? (
				<DoneCircle />
			) : state === "active" ? (
				<SpinnerArc className="size-[15px] shrink-0" />
			) : (
				<PendingRing />
			)}
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{badge}
		</div>
	);
}

/** Success-tinted check circle for completed scrape steps (tool runs read
    as green — same idiom as the mock thread's multi-action run). */
function DoneCircle() {
	return (
		<span className="grid size-[15px] shrink-0 place-items-center rounded-full bg-success/16">
			<Check className="size-2.5 text-success" strokeWidth={2.5} aria-hidden />
		</span>
	);
}

/** Stone ring for pending checklist rows. */
function PendingRing() {
	return (
		<span
			aria-hidden
			className="size-[15px] shrink-0 rounded-full border-2 border-stone"
		/>
	);
}

/* ---------- result card ---------- */

function LeadScrapeResultCard({ attempt }: { attempt: LeadScrapeAttempt }) {
	const moreRows = Math.max(
		0,
		(attempt.rowCount ?? 0) - attempt.previewRows.length,
	);
	const meta = [
		`${attempt.rowCount ?? 0} rows`,
		`${attempt.columnCount ?? 6} columns`,
		formatBytes(attempt.fileSize),
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background">
			<div className="flex items-center gap-3 p-[15px] pb-3">
				<span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-success/16">
					<FileSpreadsheet className="size-5 text-success" aria-hidden />
				</span>
				<span className="min-w-0 flex-1">
					<span
						dir="ltr"
						className="block truncate font-medium text-foreground text-sm"
					>
						{attempt.fileName ?? "leads.xlsx"}
					</span>
					<span className="block text-[12.5px] text-muted-foreground">
						{meta}
					</span>
				</span>
				<span className="shrink-0 rounded-full border border-success/40 bg-success/10 px-[11px] py-1 text-success text-xs">
					Ready
				</span>
			</div>
			{attempt.previewRows.length > 0 ? (
				<div className="mx-[15px] mb-3 overflow-hidden rounded-[10px] border border-border">
					<table className="w-full table-fixed text-[12.5px]">
						<thead>
							<tr className="bg-secondary font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
								<th className="w-7 py-1.5 text-center font-normal">#</th>
								<th className="px-2.5 py-1.5 text-start font-normal">
									Business
								</th>
								<th className="w-[92px] px-2.5 py-1.5 text-start font-normal">
									Phone
								</th>
								<th className="px-2.5 py-1.5 text-start font-normal">Email</th>
							</tr>
						</thead>
						<tbody>
							{attempt.previewRows.map((row, index) => (
								<tr
									// biome-ignore lint/suspicious/noArrayIndexKey: preview rows are an immutable ordered snapshot with no ids
									key={`${row.business}-${index}`}
									className="border-border border-t"
								>
									<td className="py-1.5 text-center font-mono text-[11px] text-faint">
										{index + 1}
									</td>
									<td
										dir="auto"
										className="truncate px-2.5 py-1.5 text-foreground"
									>
										{row.business}
									</td>
									<td
										dir="ltr"
										className="truncate px-2.5 py-1.5 font-mono text-[11.5px] text-muted-foreground"
									>
										{row.phone}
									</td>
									<td
										dir="ltr"
										className="truncate px-2.5 py-1.5 text-muted-foreground"
									>
										{row.email}
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{moreRows > 0 ? (
						<div className="border-border border-t bg-background py-1.5 text-center text-[12px] text-muted-foreground">
							+{moreRows} more rows
						</div>
					) : null}
				</div>
			) : null}
			<div className="px-[15px] pb-[15px]">
				<Button asChild size="sm" className="h-9 w-full text-[13.5px]">
					<a
						href={leadScrapeDownloadUrl(attempt.id)}
						download={attempt.fileName ?? "leads.xlsx"}
					>
						<Download className="size-4" aria-hidden />
						Download .xlsx
					</a>
				</Button>
			</div>
		</div>
	);
}

function formatBytes(bytes: number | null): string {
	if (!bytes || bytes <= 0) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Quiet spinner + line while the tool call is still in flight. */
function WorkingLine({ text }: { text: string }) {
	return (
		<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
			<SpinnerArc className="size-3.5" />
			<span>{text}</span>
		</div>
	);
}
