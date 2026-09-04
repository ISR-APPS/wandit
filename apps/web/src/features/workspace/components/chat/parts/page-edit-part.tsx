import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	Check,
	ChevronDown,
	CircleAlert,
	PanelsTopLeft,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { SpinnerArc } from "../request-tray/tray-signals";

const PAGE_EDIT_TOOL_TYPE_VALUES = [
	"tool-get_page_outline",
	"tool-apply_element_ops",
	"tool-read_elements",
	"tool-read_theme",
	"tool-read_section",
	"tool-insert_section",
	"tool-replace_section",
] as const;

export type PageEditToolPartType = (typeof PAGE_EDIT_TOOL_TYPE_VALUES)[number];

type MessagePart = WanditUIMessage["parts"][number];

export type PageEditToolPart = Extract<
	MessagePart,
	{ type: PageEditToolPartType }
>;

const PAGE_EDIT_TOOL_TYPES = new Set<string>(PAGE_EDIT_TOOL_TYPE_VALUES);
const SETTLED_STATES = new Set(["output-available", "output-error"]);
const MUTATION_TYPES = new Set<string>([
	"tool-apply_element_ops",
	"tool-insert_section",
	"tool-replace_section",
]);

type Translator = ReturnType<typeof useTranslation>["t"];
type PageEditRowStatus = "active" | "done" | "warning" | "error";

type PageEditRow = {
	detail?: string;
	label: string;
	message?: string;
	part: PageEditToolPart;
	secondary: boolean;
	status: PageEditRowStatus;
};

export function isPageEditToolPart(
	part: MessagePart,
): part is PageEditToolPart {
	return PAGE_EDIT_TOOL_TYPES.has(part.type);
}

export function isPageEditRunFullySettled(
	parts: readonly PageEditToolPart[],
): boolean {
	return parts.every((part) => SETTLED_STATES.has(part.state));
}

export function PageEditActivityCard({ parts }: { parts: PageEditToolPart[] }) {
	const { t } = useTranslation();
	const active = !isPageEditRunFullySettled(parts);
	const hasMutation = parts.some(isMutationPart);
	const appliedMutations = parts.filter(isAppliedMutation);
	const highestVersion = highestAppliedVersion(appliedMutations);
	const appliedEditCount = appliedMutations.reduce(
		(total, part) => total + mutationEditCount(part),
		0,
	);
	const [open, setOpen] = useState(active);
	const previousActive = useRef(active);

	useEffect(() => {
		if (previousActive.current === active) return;
		previousActive.current = active;
		setOpen(active);
	}, [active]);

	if (parts.length === 0) return null;

	const rows = parts.map((part, index) =>
		buildPageEditRow(
			part,
			t,
			isReadPart(part) && parts.slice(index + 1).some(isMutationPart),
		),
	);
	const settledFailureLabel = resolveSettledFailureLabel(parts, t);
	const headerLabel = active
		? t("workspace.chat.pageEdit.editing")
		: appliedMutations.length > 0
			? t("workspace.chat.pageEdit.updated", {
					n: highestVersion ?? "—",
				})
			: hasMutation
				? settledFailureLabel
				: t("workspace.chat.pageEdit.inspected");
	const receiptLabel = active
		? t("workspace.chat.pageEdit.editing")
		: appliedMutations.length > 0
			? appliedEditCount === 1
				? t("workspace.chat.pageEdit.receiptUpdatedSingle", {
						n: highestVersion ?? "—",
					})
				: t("workspace.chat.pageEdit.receiptUpdated", {
						count: appliedEditCount,
						n: highestVersion ?? "—",
					})
			: hasMutation
				? settledFailureLabel
				: t("workspace.chat.pageEdit.inspected");

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-expanded={false}
				dir="auto"
				className={cn(
					"flex w-fit max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-start text-[12px] transition-colors",
					active
						? "min-h-9 w-full border-primary/35 bg-primary/5 text-foreground"
						: "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
				)}
			>
				{active ? (
					<SpinnerArc className="size-3 shrink-0" />
				) : (
					<span className="grid size-4.5 shrink-0 place-items-center rounded-full bg-primary/10 text-ember-text">
						<PanelsTopLeft className="size-2.5" aria-hidden />
					</span>
				)}
				<span className="min-w-0 truncate font-medium">{receiptLabel}</span>
				<span className="sr-only">
					{t("workspace.chat.pageEdit.showDetails")}
				</span>
				<ChevronDown
					aria-hidden
					className="ms-auto size-3 shrink-0 text-muted-foreground"
				/>
			</button>
		);
	}

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background">
			<button
				type="button"
				onClick={() => setOpen(false)}
				aria-expanded={true}
				className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2.5 text-start"
			>
				<span className="grid size-5 shrink-0 place-items-center rounded-[6px] bg-primary/10 text-ember-text">
					<PanelsTopLeft className="size-3" aria-hidden />
				</span>
				<span
					aria-live="polite"
					dir="auto"
					className="min-w-0 flex-1 truncate font-medium text-[13.5px] text-foreground"
				>
					{headerLabel}
				</span>
				<span className="sr-only">
					{t("workspace.chat.pageEdit.hideDetails")}
				</span>
				<ChevronDown
					aria-hidden
					className="size-3.5 shrink-0 rotate-180 text-muted-foreground"
				/>
			</button>

			{active ? <PageEditLiveRail /> : null}

			<div
				className={cn(
					"divide-y divide-border",
					!active && "border-border border-t",
				)}
			>
				{rows.map((row) => (
					<PageEditActivityRow key={row.part.toolCallId} row={row} />
				))}
			</div>
		</div>
	);
}

function PageEditActivityRow({ row }: { row: PageEditRow }) {
	return (
		<div
			data-page-edit-row={row.part.type}
			data-state={row.status}
			data-secondary={row.secondary || undefined}
			className={cn(
				"flex min-w-0 items-start gap-2.5 px-3.5 py-2.5",
				row.status === "active" && "bg-primary/[0.045]",
				row.secondary && "opacity-60",
			)}
		>
			<PageEditStatusIcon status={row.status} />
			<div className="min-w-0 flex-1">
				<p
					dir="auto"
					className="min-w-0 truncate font-medium text-[13px] text-foreground"
				>
					{row.label}
				</p>
				{row.detail ? (
					<p
						dir="auto"
						className="mt-0.5 truncate text-[11.5px] text-muted-foreground"
					>
						{row.detail}
					</p>
				) : null}
				{row.message ? (
					<p
						dir="auto"
						className={cn(
							"mt-1 text-[11.5px] leading-relaxed",
							row.status === "error"
								? "text-destructive"
								: "text-amber-700 dark:text-amber-400",
						)}
					>
						{row.message}
					</p>
				) : null}
			</div>
		</div>
	);
}

function PageEditStatusIcon({ status }: { status: PageEditRowStatus }) {
	if (status === "active") {
		return <SpinnerArc className="mt-0.5 size-3.5" />;
	}

	if (status === "done") {
		return (
			<span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-success/16">
				<Check className="size-2 text-success" strokeWidth={3} aria-hidden />
			</span>
		);
	}

	if (status === "warning") {
		return (
			<CircleAlert
				className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
				aria-hidden
			/>
		);
	}

	return (
		<AlertTriangle
			className="mt-0.5 size-3.5 shrink-0 text-destructive"
			aria-hidden
		/>
	);
}

function PageEditLiveRail() {
	return (
		<div dir="ltr" className="h-0.5 w-full overflow-hidden bg-muted">
			<motion.div
				className="h-full w-1/3 bg-gradient-ember"
				animate={{ x: ["-100%", "300%"] }}
				transition={{
					duration: 1.4,
					ease: "easeInOut",
					repeat: Number.POSITIVE_INFINITY,
				}}
			/>
		</div>
	);
}

function buildPageEditRow(
	part: PageEditToolPart,
	t: Translator,
	secondary: boolean,
): PageEditRow {
	const input = partValueRecord(part, "input");
	const { status, message } = rowState(part, t);
	let label: string;
	let detail: string | undefined;

	switch (part.type) {
		case "tool-get_page_outline":
			label = t("workspace.chat.pageEdit.labels.getPageOutline");
			break;
		case "tool-read_section":
			label = t("workspace.chat.pageEdit.labels.readSection", {
				wid: recordString(input, "wid") ?? "…",
			});
			break;
		case "tool-read_elements": {
			const count = recordArray(input, "wids")?.length ?? 0;
			label = t(
				count === 1
					? "workspace.chat.pageEdit.labels.readElement"
					: "workspace.chat.pageEdit.labels.readElements",
				{ count },
			);
			break;
		}
		case "tool-read_theme":
			label = t("workspace.chat.pageEdit.labels.readTheme");
			break;
		case "tool-replace_section":
			label = t("workspace.chat.pageEdit.labels.replaceSection", {
				wid: recordString(input, "wid") ?? "…",
			});
			break;
		case "tool-insert_section": {
			const position = recordString(input, "position");
			label = t("workspace.chat.pageEdit.labels.insertSection", {
				position:
					position === "before"
						? t("workspace.chat.pageEdit.positions.before")
						: t("workspace.chat.pageEdit.positions.after"),
				wid: recordString(input, "anchorWid") ?? "…",
			});
			break;
		}
		case "tool-apply_element_ops": {
			const ops = recordArray(input, "ops") ?? [];
			label = t(
				ops.length === 1
					? "workspace.chat.pageEdit.labels.applyElementOp"
					: "workspace.chat.pageEdit.labels.applyElementOps",
				{ count: ops.length },
			);
			detail = summarizeElementOps(ops, t);
			break;
		}
	}

	return { detail, label, message, part, secondary, status };
}

function rowState(
	part: PageEditToolPart,
	t: Translator,
): { message?: string; status: PageEditRowStatus } {
	if (part.state === "output-error") {
		return {
			message:
				partRecordString(part, "errorText") ??
				t("workspace.chat.pageEdit.states.failed"),
			status: "error",
		};
	}

	if (part.state !== "output-available") return { status: "active" };

	const output = partValueRecord(part, "output");
	const outputStatus = recordString(output, "status");
	if (
		outputStatus === "rejected" ||
		outputStatus === "no-page" ||
		outputStatus === "not-found"
	) {
		return {
			message:
				recordString(output, "message") ??
				fallbackWarningMessage(outputStatus, t),
			status: "warning",
		};
	}

	return { status: "done" };
}

function fallbackWarningMessage(
	status: "rejected" | "no-page" | "not-found",
	t: Translator,
): string | undefined {
	if (status === "rejected") {
		return t("workspace.chat.pageEdit.states.rejected");
	}
	if (status === "no-page") {
		return t("workspace.chat.pageEdit.states.noPage");
	}
	return undefined;
}

function resolveSettledFailureLabel(
	parts: readonly PageEditToolPart[],
	t: Translator,
): string {
	if (parts.some((part) => part.state === "output-error")) {
		return t("workspace.chat.pageEdit.states.failed");
	}

	const statuses = parts.map((part) =>
		recordString(partValueRecord(part, "output"), "status"),
	);
	if (statuses.includes("no-page")) {
		return t("workspace.chat.pageEdit.states.noPage");
	}
	return t("workspace.chat.pageEdit.states.rejected");
}

function summarizeElementOps(
	ops: unknown[],
	t: Translator,
): string | undefined {
	const wids = distinctStrings(
		ops.map((op) => recordString(asRecord(op), "wid")),
	);
	const kinds = distinctStrings(
		ops.map((op) => recordString(asRecord(op), "kind")),
	)
		.map((kind) => translateOpKind(kind, t))
		.filter((kind): kind is string => kind !== null)
		.slice(0, 3);
	const targets = wids.slice(0, 2);
	if (wids.length > 2) {
		targets.push(
			t("workspace.chat.pageEdit.moreTargets", { count: wids.length - 2 }),
		);
	}

	const groups = [targets.join(", "), kinds.join(", ")].filter(Boolean);
	return groups.length > 0 ? groups.join(" · ") : undefined;
}

function translateOpKind(kind: string, t: Translator): string | null {
	switch (kind) {
		case "text":
			return t("workspace.chat.pageEdit.opKinds.text");
		case "image-src":
			return t("workspace.chat.pageEdit.opKinds.imageSrc");
		case "element-style":
			return t("workspace.chat.pageEdit.opKinds.elementStyle");
		case "set-tokens":
			return t("workspace.chat.pageEdit.opKinds.setTokens");
		case "set-page-title":
			return t("workspace.chat.pageEdit.opKinds.setPageTitle");
		case "set-link-href":
			return t("workspace.chat.pageEdit.opKinds.setLinkHref");
		case "remove-element":
			return t("workspace.chat.pageEdit.opKinds.removeElement");
		case "section-style":
			return t("workspace.chat.pageEdit.opKinds.sectionStyle");
		case "insert-element":
			return t("workspace.chat.pageEdit.opKinds.insertElement");
		default:
			return null;
	}
}

function isReadPart(part: PageEditToolPart): boolean {
	return !isMutationPart(part);
}

function isMutationPart(part: PageEditToolPart): boolean {
	return MUTATION_TYPES.has(part.type);
}

function isAppliedMutation(part: PageEditToolPart): boolean {
	return (
		isMutationPart(part) &&
		part.state === "output-available" &&
		recordString(partValueRecord(part, "output"), "status") === "applied"
	);
}

function highestAppliedVersion(
	parts: readonly PageEditToolPart[],
): number | undefined {
	let highest: number | undefined;
	for (const part of parts) {
		const version = recordNumber(
			partValueRecord(part, "output"),
			"versionNumber",
		);
		if (version !== undefined && (highest === undefined || version > highest)) {
			highest = version;
		}
	}
	return highest;
}

function mutationEditCount(part: PageEditToolPart): number {
	if (part.type !== "tool-apply_element_ops") return 1;
	return recordArray(partValueRecord(part, "input"), "ops")?.length ?? 1;
}

function partValueRecord(
	part: PageEditToolPart,
	key: "input" | "output",
): Record<string, unknown> | undefined {
	return asRecord(asRecord(part)?.[key]);
}

function partRecordString(
	part: PageEditToolPart,
	key: string,
): string | undefined {
	return recordString(asRecord(part), key);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null
		? (value as Record<string, unknown>)
		: undefined;
}

function recordString(
	record: Record<string, unknown> | undefined,
	key: string,
): string | undefined {
	const value = record?.[key];
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
}

function recordNumber(
	record: Record<string, unknown> | undefined,
	key: string,
): number | undefined {
	const value = record?.[key];
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function recordArray(
	record: Record<string, unknown> | undefined,
	key: string,
): unknown[] | undefined {
	const value = record?.[key];
	return Array.isArray(value) ? value : undefined;
}

function distinctStrings(values: Array<string | undefined>): string[] {
	return [
		...new Set(values.filter((value): value is string => Boolean(value))),
	];
}
