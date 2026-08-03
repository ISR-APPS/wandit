// Settings → Publishing card: live URL with copy/open + publish/unpublish,
// subdomain slug with validation and a debounced server availability check,
// and the publish history with rollback.

import type { Deployment, DeploymentStatus } from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Separator } from "@wandit/ui/components/separator";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import {
	useDeploymentsQuery,
	useSlugAvailabilityQuery,
} from "../../api/deployments.queries";
import { PUBLISHED_DOMAIN, SLUG_CHECK_DEBOUNCE_MS } from "../../lib/constants";
import { isValidSlug } from "../../lib/helpers";
import {
	canPublish as canPublishFor,
	displaySlug,
	slugVerdict,
} from "../../lib/publish-state";
import { useWorkspace } from "../../lib/store";

export function PublishSection() {
	const { t } = useTranslation();
	const {
		deployment,
		draftSlug,
		liveUrl,
		project,
		projectId,
		previewVersion,
		isPreviewingHistorical,
		publish,
		publishPending,
		rollbackTo,
		unpublish,
		updateSlug,
		versions,
	} = useWorkspace();

	const publishing = deployment?.uiState === "publishing" || publishPending;
	const failed = deployment?.uiState === "failed";
	const savedSlug = displaySlug(deployment, draftSlug, project?.name);

	const [slug, setSlug] = useState(savedSlug);
	const [slugDirty, setSlugDirty] = useState(false);
	const [syncedSlug, setSyncedSlug] = useState(savedSlug);
	// Only adopt server/display slug changes when the field is clean — never
	// clobber an in-progress edit from a background deployment refresh.
	if (!slugDirty && syncedSlug !== savedSlug) {
		setSyncedSlug(savedSlug);
		setSlug(savedSlug);
	}

	// Let typing settle before asking the server about a candidate slug.
	const [settledSlug, setSettledSlug] = useState(slug);
	useEffect(() => {
		const id = window.setTimeout(
			() => setSettledSlug(slug),
			SLUG_CHECK_DEBOUNCE_MS,
		);
		return () => window.clearTimeout(id);
	}, [slug]);

	const slugUnchanged = slug === savedSlug;
	const availabilityQuery = useSlugAvailabilityQuery(
		projectId,
		settledSlug,
		slugDirty && !slugUnchanged && isValidSlug(settledSlug),
	);

	const verdict = slugVerdict({
		slug,
		dirty: slugDirty,
		unchanged: slugUnchanged,
		checking: availabilityQuery.isFetching || slug !== settledSlug,
		availability: slug === settledSlug ? availabilityQuery.data : undefined,
	});

	const saveDisabled = verdict !== "available";

	const handleCopy = () => {
		if (!liveUrl) return;
		void navigator.clipboard.writeText(liveUrl);
		toast.success(t("workspace.publish.linkCopied"));
	};

	const handleSlugSave = () => {
		if (saveDisabled) return;
		updateSlug(slug);
		toast.success(t("settings.slugSaved"));
	};

	const deploymentsQuery = useDeploymentsQuery(projectId);
	const history = deploymentsQuery.data ?? [];
	const versionNumberById = useMemo(
		() => new Map(versions.map((v) => [v.id, v.number])),
		[versions],
	);

	const canPublish =
		Boolean(previewVersion) &&
		(canPublishFor(deployment) || isPreviewingHistorical) &&
		!publishPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-display">
					{t("settings.publishTitle")}
				</CardTitle>
				<CardDescription>{t("settings.publishDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<div className="space-y-2">
					<Label>{t("settings.liveUrlLabel")}</Label>
					{liveUrl ? (
						<div className="flex items-center gap-1">
							<a
								href={liveUrl}
								target="_blank"
								rel="noreferrer"
								className="min-w-0 flex-1 truncate font-mono text-primary text-sm hover:underline"
							>
								{liveUrl}
							</a>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t("workspace.publish.copyLink")}
								onClick={handleCopy}
							>
								<Copy className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t("workspace.publish.openLive")}
								asChild
							>
								<a
									href={liveUrl}
									target="_blank"
									rel="noreferrer"
									aria-label={t("workspace.publish.openLive")}
								>
									<ExternalLink className="size-4" />
								</a>
							</Button>
						</div>
					) : (
						<div className="flex items-center justify-between gap-3">
							<p className="text-muted-foreground text-sm">
								{failed
									? t("settings.publishFailed")
									: t("settings.notPublished")}
							</p>
							<Button
								onClick={() => {
									// Carry a valid unsaved slug edit into the publish so the
									// site doesn't go live on a stale name-derived slug.
									const publishSlug =
										slugDirty && !slugUnchanged && verdict === "available"
											? slug
											: undefined;
									if (publishSlug) {
										updateSlug(slug);
									}
									publish(publishSlug ? { slug: publishSlug } : undefined);
								}}
								disabled={!canPublish || publishing}
							>
								{publishing ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										{t("workspace.publish.publishing")}
									</>
								) : failed ? (
									t("workspace.publish.retryCta")
								) : (
									t("settings.publishCta")
								)}
							</Button>
						</div>
					)}
					{failed && deployment?.error ? (
						<p className="text-destructive text-xs">{deployment.error}</p>
					) : null}
					{liveUrl ? (
						<div className="flex flex-wrap items-center gap-2">
							{isPreviewingHistorical && previewVersion ? (
								<Button
									size="sm"
									onClick={() => publish()}
									disabled={!canPublish || publishing}
									dir="auto"
								>
									{t("workspace.publish.confirmVersion", {
										n: previewVersion.number,
									})}
								</Button>
							) : null}
							<Button
								variant="ghost"
								size="sm"
								className="text-destructive"
								onClick={() => unpublish()}
								disabled={publishPending}
							>
								{t("settings.unpublishCta")}
							</Button>
						</div>
					) : null}
				</div>

				<div className="space-y-2">
					<Label htmlFor="settings-slug">{t("settings.slugLabel")}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="settings-slug"
							className="font-mono"
							value={slug}
							onChange={(e) => {
								setSlug(e.target.value.toLowerCase());
								setSlugDirty(true);
							}}
						/>
						<span className="shrink-0 font-mono text-muted-foreground text-sm">
							{PUBLISHED_DOMAIN}
						</span>
						<Button
							size="sm"
							variant="secondary"
							onClick={handleSlugSave}
							disabled={saveDisabled}
						>
							{t("settings.slugSave")}
						</Button>
					</div>
					{verdict === "invalid" ? (
						<p className="text-destructive text-xs">
							{t("settings.slugInvalid")}
						</p>
					) : verdict === "checking" ? (
						<p className="flex items-center gap-1 text-muted-foreground text-xs">
							<Loader2 className="size-3 animate-spin" />
							{t("settings.slugChecking")}
						</p>
					) : verdict === "taken" ? (
						<p className="text-destructive text-xs">
							{t("settings.slugTaken")}
						</p>
					) : verdict === "reserved" ? (
						<p className="text-destructive text-xs">
							{t("settings.slugReserved")}
						</p>
					) : verdict === "available" ? (
						<p className="flex items-center gap-1 text-success text-xs">
							<Check className="size-3" />
							{t("settings.slugAvailable")}
						</p>
					) : null}
				</div>

				<Separator />

				<div>
					<h3 className="font-medium text-sm">{t("settings.historyTitle")}</h3>
					<div className="mt-1">
						{history.length === 0 ? (
							<p className="py-2 text-muted-foreground text-sm">
								{t("settings.historyEmpty")}
							</p>
						) : (
							history.map((row) => (
								<HistoryRow
									key={row.id}
									row={row}
									versionNumber={versionNumberById.get(row.versionId) ?? null}
									busy={publishing}
									onRollback={() =>
										rollbackTo({
											deploymentId: row.id,
											versionNumber:
												versionNumberById.get(row.versionId) ?? null,
										})
									}
								/>
							))
						)}
					</div>
				</div>

				<p className="text-[11px] text-muted-foreground">
					{t("workspace.publish.freeNote")}
				</p>
			</CardContent>
		</Card>
	);
}

// Publish attempts that once served traffic have archived bytes to restore.
const ROLLBACKABLE: DeploymentStatus[] = ["superseded", "unpublished"];

function HistoryRow({
	row,
	versionNumber,
	busy,
	onRollback,
}: {
	row: Deployment;
	versionNumber: number | null;
	busy: boolean;
	onRollback: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex items-center gap-3 py-2">
			<span className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-xs tabular-nums">
				{versionNumber !== null
					? t("workspace.page.versionShort", { n: versionNumber })
					: "—"}
			</span>
			<span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-sm">
				{row.slug}
			</span>
			<span className="shrink-0 font-mono text-muted-foreground text-xs">
				{relativeTime(row.createdAt)}
			</span>
			{row.status === "active" ? (
				<Badge variant="success" className="font-mono text-[10px]">
					{t("settings.historyLive")}
				</Badge>
			) : ROLLBACKABLE.includes(row.status) ? (
				<Button variant="ghost" size="xs" onClick={onRollback} disabled={busy}>
					{t("settings.historyRollback")}
				</Button>
			) : (
				<Badge variant="outline" className="font-mono text-[10px]">
					{t(
						row.status === "pending"
							? "settings.historyStatus.pending"
							: "settings.historyStatus.failed",
					)}
				</Badge>
			)}
		</div>
	);
}
