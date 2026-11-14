/**
 * The end card of a `security_scan` turn in the thread: the finding counts
 * per severity, the checks that did not finish, and an "Open report" pill.
 * Rendered by chat-message.tsx for each `data-security-report` part. The
 * full list stays in the Security panel; `onOpenReport` opens it.
 */

import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import type { TurnSecurityReportData } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { formatNumber, useTranslation } from "@/lib/i18n";
import { PanelChip } from "../more/panel-shell";
import {
	SECURITY_GROUP_ORDER,
	SECURITY_GROUP_TONE,
} from "../more/security-panel";
import {
	CARD_PRIMARY_PILL_CLASS,
	CardMedallion,
	MessageCard,
} from "./message-card";

/** Props of one `data-security-report` part, as chat-message.tsx passes them. */
export type SecurityReportCardProps = {
	/** Counts and check states the task wrote at the end of the scan turn. */
	report: TurnSecurityReportData;
	/** Opens `?view=more&panel=security`, where the stored report shows. */
	onOpenReport: () => void;
};

/** The scan result card: a chip per severity with findings, the check notes, and the report pill. */
export function SecurityReportCard({
	report,
	onOpenReport,
}: SecurityReportCardProps) {
	const { t, locale } = useTranslation();
	// The count keys of the part are the group names of the panel.
	const shownGroups = SECURITY_GROUP_ORDER.filter(
		(group) => report.counts[group] > 0,
	);
	const failedSources = report.checks
		.filter((check) => check.state === "failed")
		.map((check) => t(`appBuilder.security.source.${check.source}`));

	return (
		<MessageCard className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<CardMedallion icon={ShieldCheckIcon} />
				<h3 className="font-grotesk font-semibold text-[15px] text-night leading-snug dark:text-foreground">
					{t("appBuilder.security.card.title")}
				</h3>
			</div>
			{shownGroups.length > 0 ? (
				<ul className="flex flex-wrap gap-1.5">
					{shownGroups.map((group) => (
						<li key={group}>
							<PanelChip tone={SECURITY_GROUP_TONE[group]}>
								{t(`appBuilder.security.severity.${group}`)}
								<span className="tabular-nums">
									{formatNumber(report.counts[group], locale)}
								</span>
							</PanelChip>
						</li>
					))}
				</ul>
			) : (
				<p className="font-sans text-[13.5px] text-night/70 dark:text-foreground/70">
					{t("appBuilder.security.card.noIssues")}
				</p>
			)}
			{failedSources.length > 0 ? (
				<p className="font-sans text-[13px] text-night/60 leading-snug dark:text-foreground/60">
					{t("appBuilder.security.card.failedChecks", {
						sources: new Intl.ListFormat(locale).format(failedSources),
					})}
				</p>
			) : null}
			{report.saved ? null : (
				<p
					role="alert"
					className="flex items-start gap-2 font-sans text-[13px] text-destructive leading-snug"
				>
					<WarningCircleIcon
						aria-hidden
						weight="fill"
						className="mt-px size-4 shrink-0"
					/>
					{t("appBuilder.security.card.notSaved")}
				</p>
			)}
			<Button
				size="sm"
				className={cn(CARD_PRIMARY_PILL_CLASS, "w-fit")}
				onClick={onOpenReport}
			>
				{t("appBuilder.security.card.open")}
			</Button>
		</MessageCard>
	);
}
