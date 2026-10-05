/**
 * The publish gate findings of the newest publish attempt (WANDIT-181,
 * WANDIT-190). Rendered by PublishWebTargets in publish-popover.tsx. It
 * lists each finding in plain words, block findings first, and builds the
 * chat message of "Ask the AI to fix" for the turn route. On a "Publish
 * anyway" attempt, an overridable finding shows as a warning.
 */

import type { Icon } from "@phosphor-icons/react";
import { MagicWandIcon } from "@phosphor-icons/react/MagicWand";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import { XCircleIcon } from "@phosphor-icons/react/XCircle";
import {
	isGateFindingOverridable,
	type PublishGateFinding,
	projectPromptMaxLength,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";

type Translate = ReturnType<typeof useTranslation>["t"];

type Severity = PublishGateFinding["severity"];

/**
 * The quiet outline pill of a gate action: "Ask the AI to fix" here, and
 * "Publish anyway" in publish-popover.tsx. The dark: classes override the
 * dark fill and border of the kit outline variant.
 */
export const GATE_ACTION_CLASS =
	"font-grotesk font-semibold border-popover-foreground/[0.12] bg-transparent text-popover-foreground hover:bg-popover-foreground/[0.04] dark:border-white/[0.12] dark:bg-transparent dark:hover:bg-white/[0.05]";

// A block finding stops the publish, so it reads as an error. A warn finding is a caution in spark.
const SEVERITY_STYLES = {
	block: {
		icon: XCircleIcon,
		className: "text-destructive",
		textClassName: "text-popover-foreground/85",
	},
	warn: {
		icon: WarningIcon,
		className: "text-spark-deep dark:text-spark",
		textClassName: "text-popover-foreground/60",
	},
} as const satisfies Record<
	Severity,
	{ icon: Icon; className: string; textClassName: string }
>;

type PublishGateFindingsProps = {
	/** `gateFindings` of the newest publish attempt, from appPublishQuery. Not empty. */
	findings: PublishGateFinding[];
	/** `gateOverride` of the same attempt: true when the owner clicked "Publish anyway". */
	isOverride: boolean;
	/** False while the chat sends a turn or loads its history. The button is disabled then. */
	canAskFix: boolean;
	/** Sends one chat message that asks the AI to fix the findings. */
	onAskFix: (text: string) => void;
};

/** The block findings, the warn findings, and the "Ask the AI to fix" button under them. */
export function PublishGateFindings({
	findings,
	isOverride,
	canAskFix,
	onAskFix,
}: PublishGateFindingsProps) {
	const { t } = useTranslation();
	const blockFindings = findings.filter(
		(finding) => shownSeverity(finding, isOverride) === "block",
	);
	const warnFindings = findings.filter(
		(finding) => shownSeverity(finding, isOverride) === "warn",
	);

	return (
		<div className="flex flex-col gap-2.5">
			{/* A probe can flag many tables. The list scrolls, so the buttons stay in view. */}
			<div className="scroll-warm flex max-h-48 flex-col gap-2.5 overflow-y-auto rounded-[14px] bg-popover-foreground/[0.03] px-3 py-2.5 dark:bg-white/[0.03]">
				<FindingGroup severity="block" findings={blockFindings} />
				<FindingGroup severity="warn" findings={warnFindings} />
			</div>
			<Button
				variant="outline"
				size="sm"
				className={GATE_ACTION_CLASS}
				disabled={!canAskFix}
				onClick={() =>
					onAskFix(
						askFixMessage(t("appBuilder.publish.findings.askFixMessage"), [
							...blockFindings.map((finding) => findingLine(finding, "block")),
							...warnFindings.map((finding) => findingLine(finding, "warn")),
						]),
					)
				}
			>
				<MagicWandIcon aria-hidden weight="fill" />
				{t("appBuilder.publish.findings.askFix")}
			</Button>
		</div>
	);
}

/** The heading and the list of the findings of one severity. Renders nothing for an empty list. */
function FindingGroup({
	severity,
	findings,
}: {
	severity: Severity;
	findings: PublishGateFinding[];
}) {
	const { t } = useTranslation();
	if (findings.length === 0) {
		return null;
	}
	const {
		icon: SeverityIcon,
		className,
		textClassName,
	} = SEVERITY_STYLES[severity];

	return (
		<div className="flex flex-col gap-1.5">
			<h4 className={cn("font-grotesk font-semibold text-xs", className)}>
				{t(`appBuilder.publish.findings.${severity}`)}
			</h4>
			<ul className="flex flex-col gap-1.5">
				{findings.map((finding, index) => (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: a finding has no id, and the list of one attempt never changes.
						key={index}
						className={cn(
							"flex items-start gap-2 text-[12.5px] leading-snug",
							textClassName,
						)}
					>
						<SeverityIcon
							aria-hidden
							weight="fill"
							className={cn("mt-px size-4 shrink-0", className)}
						/>
						<span className="min-w-0 break-words">
							{findingText(finding, t)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

/** The severity that the list shows. It differs from the stored one only on a "Publish anyway" attempt. */
function shownSeverity(
	finding: PublishGateFinding,
	isOverride: boolean,
): Severity {
	// The owner published past the overridable findings, so they did not stop this attempt.
	return isOverride && isGateFindingOverridable(finding)
		? "warn"
		: finding.severity;
}

/** The plain sentence of one finding in the UI language. */
function findingText(finding: PublishGateFinding, t: Translate): string {
	switch (finding.kind) {
		case "secret":
			// Only `server/` holds the Worker code. Any other path counts as public, the safer reading.
			return t(
				finding.path.startsWith("server/")
					? "appBuilder.publish.findings.secretServer"
					: "appBuilder.publish.findings.secretClient",
				{
					path: finding.path,
					rule: t(`appBuilder.publish.findings.secretRules.${finding.rule}`),
					sample: finding.sample,
				},
			);
		case "phishing":
			return t("appBuilder.publish.findings.phishing", {
				target: finding.target,
			});
		case "advisor":
			// Supabase sends the title in English only.
			return t(`appBuilder.publish.findings.advisor.${finding.level}`, {
				title: finding.title,
			});
		case "rls_probe":
			return t(`appBuilder.publish.findings.rlsProbe.${finding.reason}`, {
				// The contract allows a null relation on every reason, not only on `probe_timeout`.
				relation:
					finding.relation ?? t("appBuilder.publish.findings.unknownTable"),
			});
	}
}

/**
 * The "Ask the AI to fix" message: the intro in the UI language, then one
 * technical line per finding for the agent. It stays within
 * `projectPromptMaxLength`, because the turn route refuses a longer message.
 */
function askFixMessage(intro: string, findingLines: string[]): string {
	const lines = [intro];
	let length = intro.length;
	for (const [index, line] of findingLines.entries()) {
		const restLine = `- (+${findingLines.length - index} more)`;
		// Each `+ 1` is a newline. Room stays for the line that counts the rest.
		if (
			length + 1 + line.length + 1 + restLine.length >
			projectPromptMaxLength
		) {
			lines.push(restLine);
			break;
		}
		lines.push(line);
		length += 1 + line.length;
	}
	return lines.join("\n");
}

/** One finding in a compact form: the shown severity, kind, then the fields that locate the problem. */
function findingLine(finding: PublishGateFinding, severity: Severity): string {
	const head = `- [${severity}] ${finding.kind}`;
	switch (finding.kind) {
		case "secret":
			return `${head} rule=${finding.rule} path=${finding.path}`;
		case "phishing":
			return `${head} target=${finding.target} term=${finding.term}`;
		case "advisor":
			// The detail names the table or function. An empty detail falls back to the title.
			return `${head} lint=${finding.lintId} level=${finding.level}: ${finding.detail || finding.title}`;
		case "rls_probe":
			return finding.relation === null
				? `${head} reason=${finding.reason}`
				: `${head} relation=${finding.relation} reason=${finding.reason}`;
	}
}
