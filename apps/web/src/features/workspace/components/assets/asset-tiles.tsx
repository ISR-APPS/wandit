// Shared presentational pieces of the asset galleries — the per-project
// Assets tab and the dashboard-wide Assets page render the same tiles, grid,
// filter chips and lightbox. Tiles take a prebuilt download href so callers
// decide which project scopes the forced-download route.

import type { ProjectAsset } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle, Download, Play, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { workspaceScopeHeaders } from "@/features/workspaces/lib/workspace-scope";
import { useTranslation } from "@/lib/i18n";
import { relativeTime } from "@/lib/relative-time";
import { SpinnerArc } from "../chat/request-tray/tray-signals";

type SourceLabelKey =
	| "workspace.assets.sourceGeneration"
	| "workspace.assets.sourceBuild";

const SOURCE_LABEL_KEYS: Record<ProjectAsset["source"], SourceLabelKey> = {
	"image-generation": "workspace.assets.sourceGeneration",
	"page-build": "workspace.assets.sourceBuild",
};

/**
 * The forced-download route resolves its scope from the workspace header,
 * which a plain <a href> navigation can never carry — org-workspace downloads
 * would 404. Fetch with the header + cookies instead, then hand the bytes to
 * the browser as a named blob.
 */
async function saveAsset(downloadHref: string, fileName: string) {
	const response = await fetch(downloadHref, {
		credentials: "include",
		headers: workspaceScopeHeaders(),
	});

	if (!response.ok) {
		throw new Error(`Download failed with ${response.status}`);
	}

	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

function AssetDownloadButton({
	downloadHref,
	fileName,
	labeled = false,
}: {
	downloadHref: string;
	fileName: string;
	/** Lightbox header shows the label; tiles stay icon-only. */
	labeled?: boolean;
}) {
	const { t } = useTranslation();
	const [downloading, setDownloading] = useState(false);

	const handleDownload = async () => {
		if (downloading) return;
		setDownloading(true);
		try {
			await saveAsset(downloadHref, fileName);
		} catch {
			toast.error(t("workspace.assets.downloadError"));
		} finally {
			setDownloading(false);
		}
	};

	if (labeled) {
		return (
			<Button
				size="sm"
				variant="secondary"
				className="h-8 rounded-lg"
				disabled={downloading}
				onClick={() => void handleDownload()}
			>
				{downloading ? (
					<SpinnerArc className="size-3.5" />
				) : (
					<Download className="size-3.5" aria-hidden />
				)}
				{t("workspace.assets.download")}
			</Button>
		);
	}

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			className="shrink-0 text-muted-foreground"
			aria-label={t("workspace.assets.download")}
			disabled={downloading}
			onClick={() => void handleDownload()}
		>
			{downloading ? (
				<SpinnerArc className="size-3.5" />
			) : (
				<Download className="size-3.5" aria-hidden />
			)}
		</Button>
	);
}

export function TileGrid({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
			{children}
		</div>
	);
}

export function FilterChip({
	active,
	label,
	onClick,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-full px-2.5 py-1 text-[12px] transition-colors",
				active
					? "bg-foreground text-background"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

export function AssetsError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div className="rounded-xl border border-destructive/25 bg-destructive/[0.035] p-4">
			<div className="flex items-start gap-2.5">
				<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
					<AlertTriangle className="size-3.5" aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-[13.5px] text-foreground">
						{t("workspace.assets.loadError")}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="-ms-2 mt-1 h-7 px-2 text-muted-foreground text-xs"
						disabled={retrying}
						onClick={onRetry}
					>
						{retrying ? (
							<SpinnerArc className="size-3" />
						) : (
							<RefreshCw className="size-3" aria-hidden />
						)}
						{t("workspace.assets.retry")}
					</Button>
				</div>
			</div>
		</div>
	);
}

export function AssetTile({
	asset,
	downloadHref,
	projectName,
	onOpen,
}: {
	asset: ProjectAsset;
	downloadHref: string;
	/** Dashboard grid only: label the tile with the project it belongs to. */
	projectName?: string;
	onOpen: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="group relative overflow-hidden rounded-xl border bg-card">
			<button
				type="button"
				onClick={onOpen}
				className="block w-full cursor-pointer"
				aria-label={asset.name}
			>
				<div className="relative aspect-square bg-secondary">
					{asset.kind === "image" ? (
						<img
							src={asset.url}
							alt={asset.name}
							loading="lazy"
							className="absolute inset-0 size-full object-cover"
						/>
					) : (
						<>
							<video
								src={asset.url}
								preload="metadata"
								muted
								playsInline
								className="absolute inset-0 size-full object-cover"
							/>
							<span className="absolute inset-0 grid place-items-center">
								<span className="grid size-10 place-items-center rounded-full bg-background/80 text-foreground shadow-sm">
									<Play className="ms-0.5 size-4" aria-hidden />
								</span>
							</span>
						</>
					)}
				</div>
			</button>
			<div className="flex items-center gap-2 p-2.5">
				<div className="min-w-0 flex-1">
					<p className="truncate text-[12.5px]" title={asset.name}>
						{asset.name}
					</p>
					<p className="mt-0.5 truncate font-mono text-[9.5px] text-muted-foreground uppercase tracking-wider">
						{projectName ? `${projectName} · ` : null}
						{t(SOURCE_LABEL_KEYS[asset.source])}
						{asset.createdAt ? ` · ${relativeTime(asset.createdAt)}` : null}
					</p>
				</div>
				<AssetDownloadButton
					downloadHref={downloadHref}
					fileName={asset.key.split("/").pop() ?? asset.name}
				/>
			</div>
		</div>
	);
}

export function AssetLightbox({
	asset,
	downloadHref,
	onClose,
}: {
	asset: ProjectAsset;
	downloadHref: string;
	onClose: () => void;
}) {
	const { t } = useTranslation();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-50 flex flex-col bg-foreground/70 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-label={asset.name}
		>
			{/* Full-surface backdrop button: click anywhere outside the content
			    closes, and it stays keyboard/screen-reader reachable. */}
			<button
				type="button"
				className="absolute inset-0 cursor-default"
				aria-label={t("workspace.assets.close")}
				onClick={onClose}
			/>
			<div className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col">
				<div className="flex items-center justify-between gap-3 px-4 py-3">
					<p className="min-w-0 truncate font-medium text-[13.5px] text-background">
						{asset.name}
					</p>
					<div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
						<AssetDownloadButton
							downloadHref={downloadHref}
							fileName={asset.key.split("/").pop() ?? asset.name}
							labeled
						/>
						<Button
							size="sm"
							variant="secondary"
							className="h-8 rounded-lg"
							aria-label={t("workspace.assets.close")}
							onClick={onClose}
						>
							<X className="size-4" aria-hidden />
						</Button>
					</div>
				</div>
				<div className="grid min-h-0 flex-1 place-items-center p-4 pt-0">
					{asset.kind === "image" ? (
						<img
							src={asset.url}
							alt={asset.name}
							className="pointer-events-auto max-h-full max-w-full rounded-lg object-contain shadow-2xl"
						/>
					) : (
						<video
							src={asset.url}
							controls
							autoPlay
							playsInline
							className="pointer-events-auto max-h-full max-w-full rounded-lg shadow-2xl"
						>
							<track kind="captions" />
						</video>
					)}
				</div>
			</div>
		</div>
	);
}
