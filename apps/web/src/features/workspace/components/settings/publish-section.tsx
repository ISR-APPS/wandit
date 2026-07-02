// Settings → Publishing card: live URL with copy/open + publish/unpublish,
// subdomain slug with validation and a debounced mock availability check,
// and the immutable version history with rollback.

import { Badge } from "@my-better-t-app/ui/components/badge";
import { Button } from "@my-better-t-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { Separator } from "@my-better-t-app/ui/components/separator";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { relativeTime } from "@/lib/relative-time";
import {
	PUBLISHED_DOMAIN,
	SLUG_CHECK_DEBOUNCE_MS,
	WORKSPACE_COPY,
} from "../../lib/constants";
import { hashString, isValidSlug, slugify } from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";

const COPY = WORKSPACE_COPY.settings;

export function PublishSection() {
	const {
		state,
		project,
		versions,
		liveUrl,
		publish,
		unpublish,
		rollbackTo,
		updateSlug,
	} = useWorkspace();

	const deployment = state?.deployment;
	const publishing = deployment?.state === "publishing";
	const savedSlug = deployment?.slug ?? "";

	const [slug, setSlug] = useState(savedSlug);
	const [slugDirty, setSlugDirty] = useState(false);
	const [checking, setChecking] = useState(false);
	useEffect(() => {
		setSlug(savedSlug);
		setSlugDirty(false);
	}, [savedSlug]);

	const slugValid = isValidSlug(slug);
	const slugUnchanged = slug === savedSlug;
	// The publish flow auto-assigns slugify(project.name) without a check,
	// so the mock availability rule must never contradict it.
	const autoSlug = project ? slugify(project.name, "") : "";
	const slugTaken =
		slugValid &&
		hashString(slug) % 5 === 0 &&
		slug !== deployment?.slug &&
		slug !== autoSlug;

	// Mock availability check — debounced so the verdict lands after typing.
	useEffect(() => {
		if (!slugDirty || !isValidSlug(slug)) {
			setChecking(false);
			return;
		}
		setChecking(true);
		const id = window.setTimeout(
			() => setChecking(false),
			SLUG_CHECK_DEBOUNCE_MS,
		);
		return () => window.clearTimeout(id);
	}, [slug, slugDirty]);

	const saveDisabled = !slugValid || slugTaken || checking || slugUnchanged;

	const handleCopy = () => {
		if (!liveUrl) return;
		void navigator.clipboard.writeText(liveUrl);
		toast.success(WORKSPACE_COPY.publish.linkCopied);
	};

	const handleSlugSave = () => {
		if (saveDisabled) return;
		updateSlug(slug);
		toast.success(COPY.slugSaved);
	};

	const orderedVersions = [...versions].reverse();
	const liveVersionNumber =
		versions.find((v) => v.id === deployment?.publishedVersionId)?.number ??
		null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-display">{COPY.publishTitle}</CardTitle>
				<CardDescription>{COPY.publishDescription}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<div className="space-y-2">
					<Label>{COPY.liveUrlLabel}</Label>
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
								aria-label={WORKSPACE_COPY.publish.copyLink}
								onClick={handleCopy}
							>
								<Copy className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={WORKSPACE_COPY.publish.openLive}
								asChild
							>
								<a href={liveUrl} target="_blank" rel="noreferrer">
									<ExternalLink className="size-4" />
								</a>
							</Button>
						</div>
					) : (
						<div className="flex items-center justify-between gap-3">
							<p className="text-muted-foreground text-sm">
								{COPY.notPublished}
							</p>
							<Button
								onClick={() => {
									// Carry a valid unsaved slug edit into the publish so the
									// site doesn't go live on a stale name-derived slug.
									if (slugDirty && slugValid && !slugTaken && !slugUnchanged) {
										updateSlug(slug);
									}
									publish();
								}}
								disabled={versions.length === 0 || publishing}
							>
								{publishing ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										{WORKSPACE_COPY.publish.publishing}
									</>
								) : (
									COPY.publishCta
								)}
							</Button>
						</div>
					)}
					{liveUrl ? (
						<div>
							<Button
								variant="ghost"
								size="sm"
								className="text-destructive"
								onClick={() => unpublish()}
							>
								{COPY.unpublishCta}
							</Button>
						</div>
					) : null}
				</div>

				<div className="space-y-2">
					<Label htmlFor="settings-slug">{COPY.slugLabel}</Label>
					<div className="flex items-center gap-2">
						<Input
							id="settings-slug"
							className="font-mono"
							value={slug}
							onChange={(e) => {
								setSlug(e.target.value);
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
							{COPY.slugSave}
						</Button>
					</div>
					{slugDirty ? (
						!slugValid ? (
							<p className="text-destructive text-xs">{COPY.slugInvalid}</p>
						) : checking ? (
							<p className="flex items-center gap-1 text-muted-foreground text-xs">
								<Loader2 className="size-3 animate-spin" />
								{COPY.slugChecking}
							</p>
						) : slugTaken ? (
							<p className="text-destructive text-xs">{COPY.slugTaken}</p>
						) : (
							<p className="flex items-center gap-1 text-success text-xs">
								<Check className="size-3" />
								{COPY.slugAvailable}
							</p>
						)
					) : null}
				</div>

				<Separator />

				<div>
					<h3 className="font-medium text-sm">{COPY.historyTitle}</h3>
					<div className="mt-1">
						{orderedVersions.map((version) => (
							<div key={version.id} className="flex items-center gap-3 py-2">
								<span className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-xs tabular-nums">
									{WORKSPACE_COPY.canvas.versionShort(version.number)}
								</span>
								<span dir="auto" className="min-w-0 flex-1 truncate text-sm">
									{version.label}
								</span>
								<span className="shrink-0 font-mono text-muted-foreground text-xs">
									{relativeTime(version.createdAt)}
								</span>
								{version.id === deployment?.publishedVersionId ? (
									<Badge variant="success" className="font-mono text-[10px]">
										{COPY.historyLive}
									</Badge>
								) : (
									<Button
										variant="ghost"
										size="xs"
										onClick={() => rollbackTo(version.id)}
										disabled={publishing}
									>
										{liveVersionNumber !== null &&
										version.number < liveVersionNumber
											? COPY.historyRollback
											: WORKSPACE_COPY.publish.publishUpdate(version.number)}
									</Button>
								)}
							</div>
						))}
					</div>
				</div>

				<p className="text-[11px] text-muted-foreground">
					{WORKSPACE_COPY.publish.freeNote}
				</p>
			</CardContent>
		</Card>
	);
}
