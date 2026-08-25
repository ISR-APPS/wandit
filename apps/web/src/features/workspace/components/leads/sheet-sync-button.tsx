// Compact Google Sheets sync control for the Leads tab header. One spot
// drives the whole flow: not connected → linkSocial full-page redirect to
// the Google consent screen (the sheet-sync query refetches on focus when
// the user lands back); connected without a sheet → first sync creates the
// spreadsheet; sheet present → re-sync + open link + last-synced hint,
// with the automatic-sync cadence exposed on the manual sync control.

import {
	GOOGLE_SHEETS_SCOPE,
	LEAD_SHEET_AUTO_SYNC_INTERVAL_MINUTES,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { ExternalLink, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/features/auth";
import { isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import { useSyncSheetNow } from "../../api/lead-sheet-sync.mutations";
import { useSheetSyncQuery } from "../../api/lead-sheet-sync.queries";
import { useWorkspace } from "../../lib/store";

export function SheetSyncButton() {
	const { t } = useTranslation();
	const { projectId } = useWorkspace();
	const syncState = useSheetSyncQuery(projectId);
	const syncNow = useSyncSheetNow(projectId);
	const [connecting, setConnecting] = useState(false);

	// linkSocial navigates the whole page to Google consent; `connecting`
	// keeps the button in a spinner state until the browser actually leaves.
	// errorCallbackURL matters: without it, a denied consent strands the
	// merchant on better-auth's raw error page on the API origin instead of
	// bringing them back to this tab.
	const handleConnect = async () => {
		setConnecting(true);
		const { error } = await authClient.linkSocial({
			provider: "google",
			scopes: [GOOGLE_SHEETS_SCOPE],
			callbackURL: window.location.href,
			errorCallbackURL: window.location.href,
		});
		if (error) {
			setConnecting(false);
			toast.error(t("leads.sheetSync.errorToast"));
		}
	};

	if (syncState.isPending || syncState.data === undefined) {
		return (
			<Button variant="outline" size="sm" disabled>
				<Loader2 className="animate-spin" />
				{t("leads.sheetSync.syncNow")}
			</Button>
		);
	}

	const { connected, sheet } = syncState.data;

	// A 409 from a sync means the grant is dead even though the account row
	// still claims the scope (merchant revoked access at Google, refresh token
	// expired…) — the only way out is a fresh consent, so fall back to the
	// Connect button. The linkSocial round-trip reloads the page, which clears
	// this error state.
	const needsReconnect =
		isApiClientError(syncNow.error) && syncNow.error.statusCode === 409;

	if (!connected || needsReconnect) {
		return (
			<Button
				variant="outline"
				size="sm"
				disabled={connecting}
				onClick={() => void handleConnect()}
			>
				{connecting ? (
					<Loader2 className="animate-spin" />
				) : (
					<FileSpreadsheet />
				)}
				{t("leads.sheetSync.connect")}
			</Button>
		);
	}

	const syncButton = (
		<Button
			variant="outline"
			size="sm"
			disabled={syncNow.isPending}
			onClick={() => syncNow.mutate()}
		>
			{syncNow.isPending ? (
				<Loader2 className="animate-spin" />
			) : (
				<FileSpreadsheet />
			)}
			{sheet === null
				? t("leads.sheetSync.syncFirst")
				: t("leads.sheetSync.syncNow")}
		</Button>
	);

	if (sheet === null) {
		return syncButton;
	}
	const syncControl = sheet.autoSyncEnabled ? (
		<Tooltip>
			<TooltipTrigger asChild>{syncButton}</TooltipTrigger>
			<TooltipContent>
				{t("leads.sheetSync.autoSync", {
					minutes: LEAD_SHEET_AUTO_SYNC_INTERVAL_MINUTES,
				})}
			</TooltipContent>
		</Tooltip>
	) : (
		syncButton
	);

	return (
		<div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
			{sheet.lastSyncedAt !== null ? (
				<span className="text-muted-foreground text-xs">
					{t("leads.sheetSync.lastSynced", {
						time: relativeTime(sheet.lastSyncedAt),
					})}
				</span>
			) : null}
			{syncControl}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button asChild variant="outline" size="icon-sm">
						<a
							href={sheet.spreadsheetUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={t("leads.sheetSync.open")}
						>
							<ExternalLink />
						</a>
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t("leads.sheetSync.open")}</TooltipContent>
			</Tooltip>
		</div>
	);
}
