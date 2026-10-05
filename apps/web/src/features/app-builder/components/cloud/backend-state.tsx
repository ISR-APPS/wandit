/**
 * Backend gate of the Cloud panels (WANDIT-188). Reads cloudBackendQuery and
 * shows one block per backend status; only an `active` backend shows the
 * panel it wraps. Rendered by cloud-panel-content.tsx around every panel except
 * Secrets. Calls useEnableBackend and useRestoreBackend, and links to /billing
 * when the plan has no free backend. Also exports CloudLoadFailed, the
 * failed-load block of the panels. Draws each block with PanelMessage of
 * more/panel-shell.tsx.
 */

import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { DatabaseIcon } from "@phosphor-icons/react/Database";
import { HourglassIcon } from "@phosphor-icons/react/Hourglass";
import { MoonStarsIcon } from "@phosphor-icons/react/MoonStars";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	type BackendLimitDetails,
	type BillingPlanId,
	backendLimitDetailsSchema,
	type CloudBackendResponse,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

import { isApiClientError } from "@/lib/api-client";
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
 * Text of each `failureCode` the server writes. The provisioning run writes
 * the `backend_provision_*` and `backend_base_schema_missing` codes
 * (backends.service.ts, trigger/provision-backend.runtime.ts).
 * app-backends.repository.ts writes `backend_restore_failed` in
 * markRestoreFailed and markRestoreTimedOut. The turn wake, the Cloud tab
 * read, and the pause sweep call them. Any other code shows the `unknown` text.
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
	[
		"backend_restore_failed",
		"workspace.cloud.backend.error.reasons.restoreFailed",
	],
]);

/** The plan names of the billing dictionary, so the limit text names the plan as the plan picker does. */
const PLAN_NAMES = {
	starter: "billing.planPicker.starterName",
	pro: "billing.planPicker.proName",
	business: "billing.planPicker.businessName",
} as const satisfies Record<BillingPlanId, TranslationKey>;

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
	// The enable button and the retry of an `error` row get a 403 when the plan has no free backend.
	// The next mutate() clears the error, so the limit block goes away on the next click.
	const limitReached =
		isApiClientError(enable.error) &&
		enable.error.code === "BACKEND_LIMIT_REACHED"
			? {
					// `details` is unknown on the wire. When the parse fails, the block shows the text without numbers.
					details:
						backendLimitDetailsSchema.safeParse(enable.error.details).data ??
						null,
				}
			: null;

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
					{limitReached === null ? null : (
						<BackendLimitReached details={limitReached.details} />
					)}
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
		// `creating` and `restoring` end without a click; cloudBackendPollMs reads the state every 5 s until then.
		case "creating":
			return (
				<PanelMessage
					tone="feature"
					icon={HourglassIcon}
					title={t("workspace.cloud.backend.waitingTitle")}
					text={t("workspace.cloud.backend.waiting")}
				/>
			);
		case "restoring":
			return (
				<PanelMessage
					tone="feature"
					icon={HourglassIcon}
					title={t("workspace.cloud.backend.waitingTitle")}
					text={t("workspace.cloud.backend.restoring")}
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
				<BackendFailed failureCode={backend.data.failureCode}>
					{limitReached === null ? null : (
						<BackendLimitReached details={limitReached.details} />
					)}
					{/* POST cloud/backend provisions an `error` row again and answers it as `creating`. */}
					<Button
						variant="outline"
						className={PANEL_SECONDARY_BUTTON_CLASS}
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
						{t("workspace.cloud.retry")}
					</Button>
				</BackendFailed>
			);
		default: {
			// The compiler fails here when the contract gains a status without a case above.
			const unhandled: never = backend.data.status;
			return unhandled;
		}
	}
}

/** The failure text for the code, the code itself for support, and the retry controls. */
function BackendFailed({
	failureCode,
	children,
}: {
	failureCode: CloudBackendResponse["failureCode"];
	/** The retry button, and the plan limit block when the last retry hit the limit. */
	children: ReactNode;
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
			{children}
		</PanelMessage>
	);
}

/**
 * The plan limit of a 403 `BACKEND_LIMIT_REACHED` and a link to the billing
 * page, where the owner picks a plan with more backends.
 */
function BackendLimitReached({
	details,
}: {
	/** Plan and limit from the 403 body; null when the body did not parse. */
	details: BackendLimitDetails | null;
}) {
	const { t } = useTranslation();
	let text = t("workspace.cloud.backend.limit.generic");
	if (details !== null) {
		// A limit of 0 gets its own sentence with no plan name: the server
		// sends `starter` also for an owner without a subscription.
		text =
			details.limit === 0
				? t("workspace.cloud.backend.limit.notIncluded")
				: t("workspace.cloud.backend.limit.inUse", {
						plan: t(PLAN_NAMES[details.plan]),
						count: details.limit,
					});
	}

	return (
		<div className="flex max-w-sm flex-col items-center gap-2.5 rounded-[16px] bg-spark/[0.12] px-4 py-3 dark:bg-spark/10">
			<p className="font-sans text-[14px] text-night/75 leading-relaxed dark:text-foreground/75">
				{text}
			</p>
			<Button asChild className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-9 px-4")}>
				<Link to="/billing">{t("workspace.cloud.backend.limit.seePlans")}</Link>
			</Button>
		</div>
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
