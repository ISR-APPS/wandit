/**
 * Google Sheets sync for leads.
 *
 * The merchant grants the narrow drive.file scope through a better-auth
 * linkSocial re-consent (incremental authorization — sign-in scopes stay
 * minimal, and drive.file needs no sensitive-scope review from Google).
 * We then CREATE the spreadsheet in their Drive — app-created files are
 * writable under drive.file, so no file picker is needed — and every sync
 * is a full rewrite of the sheet, so status changes flow through too.
 */
import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

// The one extra Google scope the sync needs. Shared so the web linkSocial
// call and the server-side scope check can never drift apart.
export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Shared by the Trigger cron pattern and the UI copy.
export const LEAD_SHEET_AUTO_SYNC_INTERVAL_MINUTES = 30;

export const leadSheetSchema = z.object({
	// One release cycle of tolerance for clients built ahead of the server.
	autoSyncEnabled: z.boolean().default(false),
	lastSyncedAt: isoDateTimeSchema.nullable(),
	spreadsheetUrl: z.url(),
	syncedLeadCount: z.int().min(0),
});

export type LeadSheet = z.infer<typeof leadSheetSchema>;

// connected = the user's Google account currently holds the drive.file scope
// AND the server can mint an access token for it (refresh token present or
// access token still fresh). sheet is null until the first sync creates it;
// sheet.autoSyncEnabled means the row remembers which Google account owns it.
export const leadSheetSyncStateSchema = z.object({
	connected: z.boolean(),
	sheet: leadSheetSchema.nullable(),
});

export type LeadSheetSyncState = z.infer<typeof leadSheetSyncStateSchema>;

export const leadSheetSyncRoutes = {
	/** GET — connection + sheet state for the Leads tab button. */
	state: (projectId: string) =>
		`/api/v1/projects/${projectId}/leads/sheet-sync`,
	/** POST — create the sheet if needed, then full rewrite with all leads. */
	syncNow: (projectId: string) =>
		`/api/v1/projects/${projectId}/leads/sheet-sync`,
} as const;
