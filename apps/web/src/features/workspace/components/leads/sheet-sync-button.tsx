// Google Sheets sync control for the Leads tab header, in two shapes picked
// by the SHEET_SYNC_ENABLED flag.
//
// Flag off (today): a disabled "coming soon" button, because the Google OAuth
// consent screen is not verified yet. The live component must not even mount
// then — it would fire the sheet-sync query for nothing — so the exported
// wrapper delegates to two separate components instead of branching inside
// one; hooks cannot be called conditionally.
//
// Flag on: LiveSheetSyncButton drives the whole flow from one spot — not
// connected → linkSocial full-page redirect to the Google consent screen (the
// sheet-sync query refetches on focus when the user lands back); connected
// without a sheet → first sync creates the spreadsheet; sheet present →
// re-sync + open link + last-synced hint.

import { GOOGLE_SHEETS_SCOPE } from "@wandit/contracts";
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
import { SHEET_SYNC_ENABLED } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

// The exported wrapper only picks a shape — no hooks here, so neither branch
// runs the other's effects or queries.
export function SheetSyncButton() {
	return SHEET_SYNC_ENABLED ? (
		<LiveSheetSyncButton />
	) : (
		<SheetSyncComingSoonButton />
	);
}

// The span is what carries the tooltip: a disabled Button is
// pointer-events-none, so hovering it only reaches the wrapper. The tooltip
// itself only opens on hover or focus, and a disabled button takes neither, so
// the reason is repeated for assistive technology inside the trigger.
function SheetSyncComingSoonButton() {
	const { t } = useTranslation();

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex">
					<Button variant="outline" size="sm" disabled>
						<FileSpreadsheet />
						{t("leads.sheetSync.connect")}
					</Button>
					<span className="sr-only">{t("leads.sheetSync.comingSoon")}</span>
				</span>
			</TooltipTrigger>
			<TooltipContent>{t("leads.sheetSync.comingSoon")}</TooltipContent>
		</Tooltip>
	);
}

function LiveSheetSyncButton() {
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

	return (
		<div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
			{sheet.lastSyncedAt !== null ? (
				<span className="text-muted-foreground text-xs">
					{t("leads.sheetSync.lastSynced", {
						time: relativeTime(sheet.lastSyncedAt),
					})}
				</span>
			) : null}
			{syncButton}
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
