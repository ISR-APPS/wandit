/**
 * Backend gate of the Cloud tab (WANDIT-188). Reads cloudBackendQuery and
 * shows one block per backend status; only an `active` backend shows the
 * panel it wraps. Rendered by cloud-tab.tsx around each panel that reads
 * the database. Calls useEnableBackend and useRestoreBackend.
 */

import { useQuery } from "@tanstack/react-query";
import type { CloudBackendResponse } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DatabaseZap,
	Hourglass,
	MoonStar,
	Trash2,
	TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { useEnableBackend, useRestoreBackend } from "../../api/cloud.mutations";
import { cloudBackendQuery } from "../../api/cloud.queries";
import { CodeMessage } from "../code/code-viewer";
import { RowsGridSkeleton } from "./rows-grid";

/** Props of BackendState. `children` is a panel that reads the database of the app. */
export type BackendStateProps = {
	projectId: string;
	/** True while the Cloud view is on screen. The state read waits for it. */
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
			<CodeMessage icon={TriangleAlert} text={t("workspace.cloud.loadFailed")}>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void backend.refetch()}
				>
					{t("workspace.cloud.retry")}
				</Button>
			</CodeMessage>
		);
	}

	switch (backend.data.status) {
		case "active":
			return <>{children}</>;
		// A project gets its backend on demand: from this button or from the agent.
		case "none":
			return (
				<CodeMessage
					icon={DatabaseZap}
					text={t("workspace.cloud.backend.none.description")}
				>
					<Button disabled={enable.isPending} onClick={() => enable.mutate()}>
						{t("workspace.cloud.backend.none.enable")}
					</Button>
				</CodeMessage>
			);
		// Both states end without a click; cloudBackendPollMs reads the state every 5 s until then.
		case "creating":
		case "restoring":
			return (
				<CodeMessage
					icon={Hourglass}
					text={t("workspace.cloud.backend.waiting")}
				/>
			);
		// The lifecycle pauses an unused backend. Every panel needs it awake.
		case "paused":
			return (
				<CodeMessage
					icon={MoonStar}
					text={t("workspace.cloud.backend.paused.description")}
				>
					<Button disabled={restore.isPending} onClick={() => restore.mutate()}>
						{t("workspace.cloud.backend.paused.wake")}
					</Button>
				</CodeMessage>
			);
		case "deleting":
			return (
				<CodeMessage
					icon={Trash2}
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
		<CodeMessage icon={TriangleAlert} text={t(reason)}>
			{failureCode === null ? null : (
				<p className="font-mono text-muted-foreground text-xs">
					{t("workspace.cloud.backend.error.code", { code: failureCode })}
				</p>
			)}
			{/* POST cloud/backend answers an `error` row as it is, so the button can only read the state again. */}
			<Button variant="outline" size="sm" onClick={onCheckAgain}>
				{t("workspace.cloud.backend.error.checkAgain")}
			</Button>
		</CodeMessage>
	);
}
