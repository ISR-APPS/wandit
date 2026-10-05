/**
 * Shared pieces of the two asset galleries. They are the grid, the tile card, its skeleton,
 * the error frame, the filter chip, and the lightbox. The callers are the V1 project
 * Assets tab (assets-tab.tsx) and the dashboard Assets page (workspace-assets-page.tsx).
 * Both callers render AssetTileSkeleton while the list loads. Only assets-tab.tsx uses FilterChip.
 * Each caller builds the download href. Thus the caller picks the project that scopes the download route.
 */

import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { DownloadSimpleIcon } from "@phosphor-icons/react/DownloadSimple";
import { PlayIcon } from "@phosphor-icons/react/Play";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import { XIcon } from "@phosphor-icons/react/X";
import type { ProjectAsset } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
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
			// The spark pill is the one colored action on the night overlay.
			<Button
				size="sm"
				variant="secondary"
				className="h-9 rounded-full bg-spark px-4 font-grotesk font-semibold text-night hover:bg-spark/90"
				disabled={downloading}
				onClick={() => void handleDownload()}
			>
				{downloading ? (
					<SpinnerArc className="size-4" />
				) : (
					<DownloadSimpleIcon aria-hidden weight="bold" className="size-4" />
				)}
				{t("workspace.assets.download")}
			</Button>
		);
	}

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			className="shrink-0 rounded-full text-night/70 hover:bg-night/[0.06] hover:text-night dark:text-foreground/70 dark:hover:bg-white/[0.06] dark:hover:text-foreground"
			aria-label={t("workspace.assets.download")}
			disabled={downloading}
			onClick={() => void handleDownload()}
		>
			{downloading ? (
				<SpinnerArc className="size-4" />
			) : (
				<DownloadSimpleIcon aria-hidden weight="bold" className="size-4" />
			)}
		</Button>
	);
}

/** The grid of asset cards: 2 columns on a phone, 3 from `sm`, 4 from `xl`. */
export function TileGrid({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
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

/** The asset list does not load. The same frame as the empty state of the dashboard Assets page, in red, with a retry pill. */
export function AssetsError({
	onRetry,
	retrying,
}: {
	onRetry: () => void;
	/** True while the query fetches again. The retry icon spins and the button is disabled. */
	retrying: boolean;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-destructive/25 border-solid bg-destructive/[0.035] px-6 py-14 text-center">
			<span
				aria-hidden
				className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"
			>
				<WarningIcon weight="duotone" className="size-5" />
			</span>
			<h3 className="mt-4 font-bold font-grotesk text-lg text-night dark:text-foreground">
				{t("workspace.assets.loadError")}
			</h3>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-4 rounded-full font-grotesk"
				disabled={retrying}
				onClick={onRetry}
			>
				<ArrowClockwiseIcon
					aria-hidden
					weight="bold"
					className={cn(
						"size-4",
						retrying && "animate-spin motion-reduce:animate-none",
					)}
				/>
				{t("workspace.assets.retry")}
			</Button>
		</div>
	);
}

/** The loading shape of an AssetTile: the same card, a square media block, and two text lines. */
export function AssetTileSkeleton() {
	return (
		<div className="rounded-[1.75rem] bg-white p-1.5 ring-1 ring-night/[0.08] dark:bg-card dark:ring-white/10">
			<Skeleton className="aspect-square rounded-[1.375rem]" />
			<div className="space-y-2 px-3 pt-3 pb-2.5">
				<Skeleton className="h-3.5 w-2/3" />
				<Skeleton className="h-3 w-1/2" />
			</div>
		</div>
	);
}

/**
 * One asset as a white card: square media, the file name, a meta line, and a download button.
 * The card lifts on hover and on focus, like the project card of the dashboard.
 */
export function AssetTile({
	asset,
	downloadHref,
	projectName,
	onOpen,
}: {
	asset: ProjectAsset;
	/** URL of the forced-download route of the asset. The caller builds it with projectAssetDownloadUrl. */
	downloadHref: string;
	/** Dashboard grid only: label the tile with the project it belongs to. */
	projectName?: string;
	/** Opens the lightbox of this asset. */
	onOpen: () => void;
}) {
	const { t } = useTranslation();

	return (
		// The outer div keeps still, so the cursor stays on it while the inner card lifts.
		<div className="group relative">
			<div
				className={cn(
					"h-full rounded-[1.75rem] bg-white p-1.5 ring-1 ring-night/[0.08] transition-[translate,box-shadow] duration-200",
					"motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-within:-translate-y-1",
					// A solid bottom edge, like a key. It grows when the card lifts.
					"shadow-[0_2px_0_rgb(11_16_51/0.06)] group-focus-within:shadow-[0_6px_0_rgb(11_16_51/0.12)] group-hover:shadow-[0_6px_0_rgb(11_16_51/0.12)]",
					"dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10 dark:group-hover:shadow-[0_6px_0_rgb(0_0_0/0.5)] dark:group-focus-within:shadow-[0_6px_0_rgb(0_0_0/0.5)]",
				)}
			>
				<button
					type="button"
					onClick={onOpen}
					className="block w-full cursor-pointer rounded-[1.375rem] outline-offset-2 focus-visible:outline-2 focus-visible:outline-ember"
					aria-label={asset.name}
				>
					<div className="relative aspect-square overflow-hidden rounded-[1.375rem] bg-night/[0.04] dark:bg-white/[0.04]">
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
									<span className="grid size-11 place-items-center rounded-full bg-night/80 text-paper backdrop-blur">
										<PlayIcon aria-hidden weight="fill" className="size-4" />
									</span>
								</span>
							</>
						)}
					</div>
				</button>
				<div className="flex items-center gap-2 ps-3 pe-1.5 pt-2.5 pb-1.5">
					<div className="min-w-0 flex-1">
						{/* The title is 13 px, not 15 px like the project card. A tile is about half as wide. */}
						{/* The line follows the page side, like the meta line. bdi keeps the name in its own direction. */}
						<p
							className="truncate font-grotesk font-semibold text-[13px] text-night tracking-[-0.01em] dark:text-foreground"
							title={asset.name}
						>
							<bdi>{asset.name}</bdi>
						</p>
						<p className="mt-0.5 truncate text-night/60 text-xs dark:text-foreground/60">
							{/* bdi keeps a Latin project name in order inside an Arabic line, and the reverse. */}
							{projectName ? (
								<>
									<bdi>{projectName}</bdi>
									{" · "}
								</>
							) : null}
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
		</div>
	);
}

/**
 * The full media of one asset over a night overlay. Escape, the close
 * button, and a click outside the media close it.
 */
export function AssetLightbox({
	asset,
	downloadHref,
	onClose,
}: {
	asset: ProjectAsset;
	/** URL of the forced-download route of the asset. The caller builds it with projectAssetDownloadUrl. */
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
			className="fixed inset-0 z-50 flex flex-col bg-night/85 backdrop-blur-sm"
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
					<p
						dir="auto"
						className="min-w-0 truncate font-grotesk font-semibold text-[15px] text-paper"
					>
						{asset.name}
					</p>
					<div className="pointer-events-auto flex shrink-0 items-center gap-2">
						<AssetDownloadButton
							downloadHref={downloadHref}
							fileName={asset.key.split("/").pop() ?? asset.name}
							labeled
						/>
						<Button
							size="icon"
							variant="secondary"
							className="rounded-full bg-white/10 text-paper hover:bg-white/20"
							aria-label={t("workspace.assets.close")}
							onClick={onClose}
						>
							<XIcon aria-hidden weight="bold" className="size-4" />
						</Button>
					</div>
				</div>
				{/* The fixed row height lets max-h-full work, so a tall image fits the screen. */}
				<div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] place-items-center p-4 pt-0">
					{asset.kind === "image" ? (
						<img
							src={asset.url}
							alt={asset.name}
							className="pointer-events-auto max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
						/>
					) : (
						<video
							src={asset.url}
							controls
							autoPlay
							playsInline
							className="pointer-events-auto max-h-full max-w-full rounded-2xl shadow-2xl"
						>
							<track kind="captions" />
						</video>
					)}
				</div>
			</div>
		</div>
	);
}
