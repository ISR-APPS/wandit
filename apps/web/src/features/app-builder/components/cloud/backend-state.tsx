/**
 * Backend gate of the Cloud panels (WANDIT-188). Reads cloudBackendQuery and
 * shows one block per backend status; only an `active` backend shows the
 * panel it wraps. Rendered by cloud-panel-content.tsx around every panel except
 * Secrets. Calls useEnableBackend and useRestoreBackend. Also exports
 * CloudLoadFailed, the failed-load block of the panels. Draws each block
 * with PanelMessage of more/panel-shell.tsx.
 */

import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { DatabaseIcon } from "@phosphor-icons/react/Database";
import { HourglassIcon } from "@phosphor-icons/react/Hourglass";
import { MoonStarsIcon } from "@phosphor-icons/react/MoonStars";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CloudBackendResponse } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { useEnableBackend, useRestoreBackend } from "../../api/cloud.mutations";
import { cloudBackendQuery, cloudKeys } from "../../api/cloud.queries";
import {
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
	PanelChip,
	PanelMessage,
} from "../more/panel-shell";
import { RowsGridSkeleton } from "./rows-grid";

/** The ember pill of a backend block: the one action that moves the backend forward. */
const BACKEND_ACTION_CLASS = cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5");

/** Props of BackendState. `children` is a panel that reads the database of the app. */
export type BackendStateProps = {
	projectId: string;
	/** True while the More view is on screen. The state read waits for it. */
	isActive: boolean;
	/** The panel to show while the backend is `active`. */
	children: ReactNode;
};

/**
 * Text of each `failureCode` the provisioning run writes (apps/server:
 * backends.service.ts and trigger/provision-backend.runtime.ts). Any
 * other code shows the `unknown` text.
 */
const FAILURE_REASONS = new Map<string, TranslationKey>([
	[
		"backend_provision_start_failed",
		"workspace.cloud.backend.error.reasons.startFailed",
	],
	[
		"backend_provision_unconfigured",
		"workspace.cloud.backend.error.reasons.unconfigured",
	],
	[
		"backend_provision_failed",
		"workspace.cloud.backend.error.reasons.provisionFailed",
	],
	[
		"backend_provision_timeout",
		"workspace.cloud.backend.error.reasons.timeout",
	],
	[
		"backend_base_schema_missing",
		"workspace.cloud.backend.error.reasons.baseSchemaMissing",
	],
]);

/**
 * Shows `children` only while the backend is `active`. Every other status,
 * the first load, and a failed first load show their own block.
 */
export function BackendState({
	projectId,
	isActive,
	children,
}: BackendStateProps) {
	const { t } = useTranslation();
	const backend = useQuery(cloudBackendQuery(projectId, isActive));
	const enable = useEnableBackend(projectId);
	const restore = useRestoreBackend(projectId);

	if (backend.isPending) {
		return <RowsGridSkeleton />;
	}
	// A failed refetch keeps the last good state; only a failed first load has no data.
	if (backend.data === undefined) {
		return (
			<PanelMessage
				icon={WarningCircleIcon}
				text={t("workspace.cloud.loadFailed")}
			>
				<Button
					variant="outline"
					size="sm"
					className={PANEL_SECONDARY_BUTTON_CLASS}
					onClick={() => void backend.refetch()}
				>
					{t("workspace.cloud.retry")}
				</Button>
			</PanelMessage>
		);
	}

	switch (backend.data.status) {
		case "active":
			return <>{children}</>;
		// A project gets its backend on demand: from this button or from the agent.
		case "none":
			return (
				<PanelMessage
					tone="feature"
					icon={DatabaseIcon}
					title={t("workspace.cloud.backend.none.title")}
					text={t("workspace.cloud.backend.none.description")}
				>
					<Button
						className={BACKEND_ACTION_CLASS}
						disabled={enable.isPending}
						onClick={() => enable.mutate()}
					>
						{enable.isPending ? (
							<CircleNotchIcon
								aria-hidden
								weight="bold"
								className="animate-spin"
							/>
						) : null}
						{t("workspace.cloud.backend.none.enable")}
					</Button>
				</PanelMessage>
			);
		// Both states end without a click; cloudBackendPollMs reads the state every 5 s until then.
		case "creating":
		case "restoring":
			return (
				<PanelMessage
					tone="feature"
					icon={HourglassIcon}
					title={t("workspace.cloud.backend.waitingTitle")}
					text={t("workspace.cloud.backend.waiting")}
				/>
			);
		// The lifecycle pauses an unused backend. Every panel needs it awake.
		case "paused":
			return (
				<PanelMessage
					tone="feature"
					icon={MoonStarsIcon}
					title={t("workspace.cloud.backend.paused.title")}
					text={t("workspace.cloud.backend.paused.description")}
				>
					<Button
						className={BACKEND_ACTION_CLASS}
						disabled={restore.isPending}
						onClick={() => restore.mutate()}
					>
						{restore.isPending ? (
							<CircleNotchIcon
								aria-hidden
								weight="bold"
								className="animate-spin"
							/>
						) : null}
						{t("workspace.cloud.backend.paused.wake")}
					</Button>
				</PanelMessage>
			);
		case "deleting":
			return (
				<PanelMessage
					tone="feature"
					icon={TrashIcon}
					title={t("workspace.cloud.backend.deletingTitle")}
					text={t("workspace.cloud.backend.deleting")}
				/>
			);
		case "error":
			return (
				<BackendFailed
					failureCode={backend.data.failureCode}
					onCheckAgain={() => void backend.refetch()}
				/>
			);
		default: {
			// The compiler fails here when the contract gains a status without a case above.
			const unhandled: never = backend.data.status;
			return unhandled;
		}
	}
}

/** The failure text for the code, the code itself for support, and a new read of the state. */
function BackendFailed({
	failureCode,
	onCheckAgain,
}: {
	failureCode: CloudBackendResponse["failureCode"];
	onCheckAgain: () => void;
}) {
	const { t } = useTranslation();
	const reason =
		(failureCode === null ? undefined : FAILURE_REASONS.get(failureCode)) ??
		"workspace.cloud.backend.error.reasons.unknown";

	return (
		<PanelMessage
			tone="feature"
			icon={WarningCircleIcon}
			title={t("workspace.cloud.backend.error.title")}
			text={t(reason)}
		>
			{failureCode === null ? null : (
				<PanelChip className="font-mono">
					{t("workspace.cloud.backend.error.code", { code: failureCode })}
				</PanelChip>
			)}
			{/* POST cloud/backend answers an `error` row as it is, so the button can only read the state again. */}
			<Button
				variant="outline"
				className={PANEL_SECONDARY_BUTTON_CLASS}
				onClick={onCheckAgain}
			>
				{t("workspace.cloud.backend.error.checkAgain")}
			</Button>
		</PanelMessage>
	);
}

/**
 * The failed first load of a Cloud panel and a retry. The retry reads every
 * Cloud query again, the backend state too: a 409 can mean the backend fell
 * asleep, and the gate then shows the wake-up block.
 */
export function CloudLoadFailed({ projectId }: { projectId: string }) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();

	return (
		<PanelMessage
			icon={WarningCircleIcon}
			text={t("workspace.cloud.sectionLoadFailed")}
		>
			<Button
				variant="outline"
				size="sm"
				className={PANEL_SECONDARY_BUTTON_CLASS}
				onClick={() =>
					void queryClient.invalidateQueries({
						queryKey: cloudKeys.all(projectId),
					})
				}
			>
				{t("workspace.cloud.retry")}
			</Button>
		</PanelMessage>
	);
}
