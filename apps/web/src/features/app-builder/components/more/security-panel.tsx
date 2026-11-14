/**
 * Security panel of the More view. It explains the scan, starts a
 * `security_scan` turn, and shows the newest stored report: the checks that
 * did not run and the findings grouped by severity. A Fix button sends a
 * build turn with the finding text. Rendered by more-view.tsx for editors
 * only; reads latestSecurityScanQuery. The page sends the turns.
 */

import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { MagicWandIcon } from "@phosphor-icons/react/MagicWand";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { useQuery } from "@tanstack/react-query";
import {
	builderMessageMaxLength,
	type SecurityFindingSeverity,
	type SecurityScanCheck,
	type SecurityScanFinding,
	securityFindingSeverities,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { getApiErrorMessage } from "@/lib/api-client";
import {
	formatDate,
	formatNumber,
	type TranslationKey,
	useTranslation,
} from "@/lib/i18n";
import { latestSecurityScanQuery } from "../../api/security-scan.queries";
import { CLOUD_DATE_TIME_FORMAT } from "../../lib/constants";
import {
	PANEL_CARD_CLASS,
	PANEL_CARD_TITLE_CLASS,
	PANEL_HINT_CLASS,
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
	type PanelChipTone,
	PanelMessage,
} from "./panel-shell";

/** A severity group of the panel. `needsReview` holds the findings that have no severity. */
export type SecurityFindingGroup = SecurityFindingSeverity | "needsReview";

/** Chip tone of each group. The chat card uses it too, so the colors match. */
export const SECURITY_GROUP_TONE = {
	critical: "danger",
	high: "danger",
	medium: "warning",
	low: "neutral",
	info: "neutral",
	needsReview: "ember",
} as const satisfies Record<SecurityFindingGroup, PanelChipTone>;

/**
 * Display order of the groups: most severe first, then the findings to check
 * by hand. The chat card shows its counts in the same order.
 */
export const SECURITY_GROUP_ORDER: readonly SecurityFindingGroup[] = [
	...securityFindingSeverities,
	"needsReview",
];

// The server writes these machine reasons on a check (contracts `securityScanCheckSchema`).
// A reason that is not here shows the generic sentence.
const CHECK_REASON_KEYS = new Map<string, TranslationKey>([
	["no_backend", "appBuilder.security.reasons.no_backend"],
	["backend_paused", "appBuilder.security.reasons.backend_paused"],
	["advisors_failed", "appBuilder.security.reasons.advisors_failed"],
	[
		"advisors_unconfigured",
		"appBuilder.security.reasons.advisors_unconfigured",
	],
	["audit_failed", "appBuilder.security.reasons.audit_failed"],
	["audit_unreadable", "appBuilder.security.reasons.audit_unreadable"],
	["findings_missing", "appBuilder.security.reasons.findings_missing"],
	["findings_unreadable", "appBuilder.security.reasons.findings_unreadable"],
]);

/** Props of SecurityPanel. more-view.tsx passes them from the page. */
export type SecurityPanelProps = {
	projectId: string;
	/** True while the More view is on screen. The report read waits for it. */
	isActive: boolean;
	/** False while the chat loads or a turn runs. The scan and Fix buttons are then disabled. */
	canSendTurn: boolean;
	/** Sends the `security_scan` turn and opens the chat. */
	onRunScan: () => void;
	/** Sends a build turn with this text and opens the chat. */
	onAskFix: (text: string) => void;
};

/** The intro card with the scan button, then the newest report. */
export function SecurityPanel({
	projectId,
	isActive,
	canSendTurn,
	onRunScan,
	onAskFix,
}: SecurityPanelProps) {
	const { t } = useTranslation();

	return (
		<>
			<section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-4 p-5")}>
				<h2 className={PANEL_CARD_TITLE_CLASS}>
					{t("appBuilder.security.title")}
				</h2>
				<div className="flex flex-col gap-2">
					<p className={PANEL_HINT_CLASS}>{t("appBuilder.security.checks")}</p>
					<p className={PANEL_HINT_CLASS}>{t("appBuilder.security.credits")}</p>
					<p className={PANEL_HINT_CLASS}>{t("appBuilder.security.noProof")}</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5")}
						disabled={!canSendTurn}
						onClick={onRunScan}
					>
						<ShieldCheckIcon aria-hidden weight="bold" />
						{t("appBuilder.security.run")}
					</Button>
					{canSendTurn ? null : (
						<p className={PANEL_HINT_CLASS}>
							{t("appBuilder.security.busyHint")}
						</p>
					)}
				</div>
			</section>
			<LatestScan
				projectId={projectId}
				isActive={isActive}
				canSendTurn={canSendTurn}
				onAskFix={onAskFix}
			/>
		</>
	);
}

/** The newest report: its summary card, then the findings by group. Loading, error, and empty states included. */
function LatestScan({
	projectId,
	isActive,
	canSendTurn,
	onAskFix,
}: Omit<SecurityPanelProps, "onRunScan">) {
	const { t, locale } = useTranslation();
	const latest = useQuery(latestSecurityScanQuery(projectId, isActive));

	// A failed refetch keeps the last report on screen. Only a first load without data shows the error.
	if (latest.data === undefined) {
		return latest.isError ? (
			<PanelMessage
				icon={WarningCircleIcon}
				text={getApiErrorMessage(latest.error)}
			/>
		) : (
			<Skeleton className="h-[160px] rounded-[20px]" />
		);
	}

	const { scan } = latest.data;
	if (scan === null) {
		return (
			<PanelMessage
				icon={ShieldCheckIcon}
				title={t("appBuilder.security.noScan.title")}
				text={t("appBuilder.security.noScan.text")}
			/>
		);
	}

	const { findings, checks } = scan.report;
	const incompleteChecks = checks.filter((check) => check.state !== "ok");
	// Product rule: "Fix all" covers only the confirmed critical and high findings.
	const urgentFindings = findings.filter(
		(finding) =>
			finding.status === "confirmed" &&
			(finding.severity === "critical" || finding.severity === "high"),
	);

	return (
		<>
			<section className={cn(PANEL_CARD_CLASS, "flex flex-col gap-3 p-5")}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className={PANEL_CARD_TITLE_CLASS}>
						{t("appBuilder.security.lastScan", {
							date: formatDate(scan.createdAt, locale, CLOUD_DATE_TIME_FORMAT),
						})}
					</h2>
					<PanelChip tone={findings.length > 0 ? "warning" : "success"}>
						{t("appBuilder.security.issueCount", { count: findings.length })}
					</PanelChip>
				</div>
				{incompleteChecks.length > 0 ? (
					<ul className="flex flex-col gap-1.5">
						{incompleteChecks.map((check) => (
							<li
								key={check.source}
								className={cn(PANEL_HINT_CLASS, "flex items-start gap-2")}
							>
								<WarningCircleIcon
									aria-hidden
									weight="fill"
									className="mt-px size-4 shrink-0 text-spark-deep dark:text-spark"
								/>
								<span>{checkLine(check, t)}</span>
							</li>
						))}
					</ul>
				) : null}
				{urgentFindings.length > 0 ? (
					<Button
						variant="outline"
						className={cn(PANEL_SECONDARY_BUTTON_CLASS, "w-fit")}
						disabled={!canSendTurn}
						onClick={() =>
							onAskFix(
								securityFixMessage(
									t("appBuilder.security.fixMessage"),
									urgentFindings,
								),
							)
						}
					>
						<MagicWandIcon aria-hidden weight="fill" />
						{t("appBuilder.security.fixAll", { count: urgentFindings.length })}
					</Button>
				) : null}
			</section>
			{findings.length === 0 ? (
				<PanelMessage
					icon={ShieldCheckIcon}
					title={t("appBuilder.security.noIssues.title")}
					text={t("appBuilder.security.noIssues.text")}
				/>
			) : (
				SECURITY_GROUP_ORDER.map((group) => {
					const groupFindings = findings.filter(
						(finding) => groupOf(finding) === group,
					);
					if (groupFindings.length === 0) return null;
					return (
						<section key={group} className="flex flex-col gap-3">
							<h3 className="flex items-center gap-2">
								<PanelChip tone={SECURITY_GROUP_TONE[group]}>
									{t(`appBuilder.security.severity.${group}`)}
								</PanelChip>
								<span className="font-grotesk font-medium text-[13px] text-night/55 tabular-nums dark:text-foreground/55">
									{formatNumber(groupFindings.length, locale)}
								</span>
							</h3>
							<ul className="flex flex-col gap-3">
								{groupFindings.map((finding) => (
									<li key={finding.id}>
										<FindingCard
											finding={finding}
											canSendTurn={canSendTurn}
											onFix={() =>
												onAskFix(
													securityFixMessage(
														t("appBuilder.security.fixMessage"),
														[finding],
													),
												)
											}
										/>
									</li>
								))}
							</ul>
						</section>
					);
				})
			)}
		</>
	);
}

/**
 * One finding: title, source chip, location, detail, how to fix, the link,
 * and the Fix button. Every text is untrusted, so it renders as plain text.
 */
function FindingCard({
	finding,
	canSendTurn,
	onFix,
}: {
	finding: SecurityScanFinding;
	/** False while a turn runs: the Fix button is then disabled. */
	canSendTurn: boolean;
	onFix: () => void;
}) {
	const { t } = useTranslation();
	// Security check: the link comes from the agent or an advisory feed. Only an https link opens.
	const link = finding.url?.startsWith("https://") ? finding.url : null;

	return (
		<article className={cn(PANEL_CARD_CLASS, "flex flex-col gap-2.5 p-4")}>
			<div className="flex items-start justify-between gap-3">
				<h4
					dir="auto"
					className={cn(PANEL_CARD_TITLE_CLASS, "min-w-0 break-words")}
				>
					{finding.title}
				</h4>
				<PanelChip>
					{t(`appBuilder.security.source.${finding.source}`)}
				</PanelChip>
			</div>
			{finding.location !== null ? (
				<p className="text-[12.5px] text-night/60 dark:text-foreground/60">
					{/* A file path or a package name reads left to right, also in Arabic. */}
					<code dir="ltr" className="break-all font-mono">
						{finding.location}
					</code>
				</p>
			) : null}
			{finding.detail !== "" ? (
				<p
					dir="auto"
					className="whitespace-pre-wrap break-words font-sans text-[14px] text-night/75 leading-relaxed dark:text-foreground/75"
				>
					{finding.detail}
				</p>
			) : null}
			{finding.fix !== "" ? (
				<div className="rounded-[14px] bg-night/[0.03] px-3.5 py-2.5 dark:bg-white/[0.04]">
					<p className="font-grotesk font-medium text-[12px] text-night/55 dark:text-foreground/55">
						{t("appBuilder.security.fixLabel")}
					</p>
					<p
						dir="auto"
						className="mt-0.5 whitespace-pre-wrap break-words font-sans text-[13.5px] text-night/75 leading-relaxed dark:text-foreground/75"
					>
						{finding.fix}
					</p>
				</div>
			) : null}
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="outline"
					size="sm"
					className={PANEL_SECONDARY_BUTTON_CLASS}
					disabled={!canSendTurn}
					onClick={onFix}
				>
					<MagicWandIcon aria-hidden weight="fill" />
					{t("appBuilder.security.fix")}
				</Button>
				{link !== null ? (
					<a
						href={link}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 font-grotesk font-medium text-[13px] text-ember-text hover:underline"
					>
						{t("appBuilder.security.learnMore")}
						<ArrowSquareOutIcon aria-hidden weight="bold" />
					</a>
				) : null}
			</div>
		</article>
	);
}

/** The group of a finding. A finding without a confirmed severity goes to `needsReview`. */
function groupOf(finding: SecurityScanFinding): SecurityFindingGroup {
	return finding.status === "confirmed" && finding.severity !== null
		? finding.severity
		: "needsReview";
}

/** The sentence of a skipped or failed check, with its translated reason. */
function checkLine(
	check: SecurityScanCheck,
	t: ReturnType<typeof useTranslation>["t"],
): string {
	const reason = t(
		(check.reason === null ? undefined : CHECK_REASON_KEYS.get(check.reason)) ??
			"appBuilder.security.reasons.generic",
	);
	const source = t(`appBuilder.security.source.${check.source}`);
	return check.state === "failed"
		? t("appBuilder.security.checkState.failed", { source, reason })
		: t("appBuilder.security.checkState.skipped", { source, reason });
}

/**
 * The chat message of a Fix button: the intro in the UI language, then the
 * findings in one fenced block for the agent. The finding text comes from
 * the agent or an advisory feed, so it cannot close the fence and pose as
 * the user. The message stays within `builderMessageMaxLength` (50,000
 * chars), and the closing fence always stays.
 */
export function securityFixMessage(
	intro: string,
	findings: readonly SecurityScanFinding[],
): string {
	const open = `${intro}\n\n\`\`\`\n`;
	const close = "\n```";
	const body = findings
		.map((finding) =>
			[
				`[${finding.severity ?? "needs_review"}] ${finding.title} (${finding.source})`,
				finding.location === null ? null : `Location: ${finding.location}`,
				finding.detail === "" ? null : `Detail: ${finding.detail}`,
				finding.fix === "" ? null : `Fix: ${finding.fix}`,
				finding.url === null ? null : `Link: ${finding.url}`,
			]
				.filter((line) => line !== null)
				.join("\n"),
		)
		.join("\n\n")
		.replaceAll("```", "'''");
	// A long "Fix all" list loses its end. The cut keeps room for the closing fence.
	const room = Math.max(
		0,
		builderMessageMaxLength - open.length - close.length,
	);
	// The text or the cut can hold half of a UTF-16 pair; Postgres refuses it,
	// so each one becomes U+FFFD (one code unit, so the length stays).
	return `${open}${body.slice(0, room)}${close}`.replace(/\p{Cs}/gu, "�");
}
