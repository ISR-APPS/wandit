// The Page tab: preview stage rendering the active landing-page version in a
// sandboxed iframe (mobile frame by default), plus generating/empty/failed
// states. LIVE data: the overview query polls while a build runs in the
// background (queued/generating) and the version's HTML is fetched separately
// once it exists — see api/pages.queries.ts. Its controls (version switcher,
// viewport toggle, preview actions) live in the main card's header — see
// shell/main-pane-header.tsx / page-toolbar.tsx (still on mock versions this
// slice). The right edge of the stage is reserved column space for a future
// element-inspector rail (click-to-edit, post-MVP).
// Failure-state strings are hardcoded English this pass (same temporary rule
// as the request-tray chrome); they move to the dictionary later.

import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { Spark } from "@/components/logo";
import { useDictionary, useTranslation } from "@/lib/i18n";
import {
	usePageOverviewQuery,
	useVersionHtmlQuery,
} from "../../api/pages.queries";
import { useWorkspace } from "../../lib/store";

export function PageTab({ reloadKey }: { reloadKey: number }) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* The stage floor is plain parchment (3a reference) — one step
			    lighter than the sand card that hosts it. */}
			<div className="relative min-h-0 flex-1 overflow-hidden bg-background">
				<PreviewStage reloadKey={reloadKey} />
			</div>
		</div>
	);
}

function PreviewStage({ reloadKey }: { reloadKey: number }) {
	const { t } = useTranslation();
	const { project, projectId, viewport } = useWorkspace();

	const overviewQuery = usePageOverviewQuery(projectId);
	const overview = overviewQuery.data;
	const activeVersion = overview?.activeVersion ?? null;
	// Immutable HTML, fetched once per version (staleTime Infinity).
	const htmlQuery = useVersionHtmlQuery(activeVersion?.id);
	const html = htmlQuery.data?.html ?? "";

	const attempt = overview?.latestAttempt ?? null;
	const isBuilding =
		attempt?.status === "queued" || attempt?.status === "generating";
	// The number the running build will produce: one past what's showing.
	const pendingVersionNumber = (activeVersion?.number ?? 0) + 1;

	if (overviewQuery.isPending || (activeVersion && htmlQuery.isPending)) {
		return (
			<div className="relative flex h-full items-center justify-center p-6">
				<Skeleton className="h-full max-h-[720px] w-[390px] max-w-full rounded-[2rem]" />
			</div>
		);
	}

	if (!activeVersion) {
		return (
			<div className="relative flex h-full items-center justify-center p-6">
				{isBuilding ? (
					<GeneratingPanel pendingVersionNumber={pendingVersionNumber} />
				) : attempt?.status === "failed" ? (
					<FailedPanel error={attempt.error} />
				) : (
					<EmptyPreview />
				)}
			</div>
		);
	}

	const mobile = viewport === "mobile";

	return (
		<div className="relative flex h-full items-center justify-center p-4 md:p-6">
			<span className="absolute start-4 top-3.5 z-10 text-muted-foreground text-xs">
				{mobile
					? t("workspace.page.viewportMobile")
					: t("workspace.page.viewportDesktop")}
			</span>
			{attempt?.status === "failed" ? (
				// A later build failed but this version still stands — quiet note
				// instead of hijacking the whole stage.
				<div className="absolute top-3 left-1/2 z-10 flex max-w-[80%] -translate-x-1/2 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-destructive text-xs">
					<AlertTriangle className="size-3 shrink-0" aria-hidden />
					<span className="min-w-0 truncate">
						{attempt.error ?? "The last build failed."}
					</span>
				</div>
			) : null}
			<motion.div
				layout
				transition={{ type: "spring", bounce: 0.14, duration: 0.55 }}
				className={cn(
					"relative flex min-h-0 overflow-hidden",
					mobile
						? // Dark phone bezel (3a reference): the generated page is the
							// only place the system goes dark.
							"h-full max-h-[632px] w-[304px] max-w-full rounded-[38px] border border-black/12 bg-[#0a0a0c] p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0_/_0.4)]"
						: "h-full w-full max-w-[1440px] rounded-2xl border bg-white shadow-shell",
				)}
			>
				<div
					className={cn(
						"relative flex min-h-0 flex-1 overflow-hidden",
						// The screen stays void-dark so the load-in feels like a phone
						// waking up; the iframe paints its own page background.
						mobile ? "rounded-[31px] bg-void" : "rounded-none bg-white",
					)}
				>
					<PreviewFrame
						key={`${activeVersion.id}-${reloadKey}-${viewport}`}
						html={html}
						title={`${project?.name ?? t("workspace.page.previewFallback")} — v${activeVersion.number}`}
					/>
					{/* Bezel handle bar — physically centered; no reading direction. */}
					{mobile ? (
						<span
							aria-hidden
							className="pointer-events-none absolute top-2 left-1/2 z-10 h-[5px] w-[70px] -translate-x-1/2 rounded-full bg-white/18"
						/>
					) : null}
				</div>
				{isBuilding ? (
					<div className="absolute inset-0 z-10 grid place-items-center bg-background/55 backdrop-blur-[2px]">
						<GeneratingPanel pendingVersionNumber={pendingVersionNumber} />
					</div>
				) : null}
			</motion.div>
		</div>
	);
}

/**
 * Sandboxed preview — no allow-same-origin, mirroring how user HTML will be
 * isolated in production. Remounted (via key) on version switch or reload.
 */
function PreviewFrame({ html, title }: { html: string; title: string }) {
	const [loaded, setLoaded] = useState(false);
	return (
		<iframe
			srcDoc={html}
			sandbox="allow-scripts allow-forms"
			title={title}
			onLoad={() => setLoaded(true)}
			className={cn(
				"size-full border-0 bg-white transition-opacity duration-300",
				loaded ? "opacity-100" : "opacity-0",
			)}
		/>
	);
}

function GeneratingPanel({
	pendingVersionNumber,
}: {
	/** The version number the in-flight build will produce. */
	pendingVersionNumber: number;
}) {
	const { t } = useTranslation();
	const dictionary = useDictionary();
	const generatingSteps = dictionary.workspace.page.generatingSteps;
	const [stepIndex, setStepIndex] = useState(0);

	useEffect(() => {
		const id = window.setInterval(
			() => setStepIndex((index) => (index + 1) % generatingSteps.length),
			1400,
		);
		return () => window.clearInterval(id);
	}, [generatingSteps.length]);

	return (
		<div className="relative flex w-72 flex-col items-center gap-4 rounded-2xl border bg-card/90 p-6 text-center shadow-xl backdrop-blur-sm">
			<div className="relative">
				<div
					aria-hidden
					className="absolute -inset-2 animate-pulse rounded-full bg-gradient-ember opacity-20 blur-md"
				/>
				<span className="relative grid size-11 place-items-center rounded-full border border-primary/30 bg-background">
					<Spark className="size-4 animate-pulse text-primary" />
				</span>
			</div>
			<div>
				<p className="font-display font-semibold text-sm">
					{t("workspace.page.generatingTitle", { n: pendingVersionNumber })}
				</p>
				<p className="mt-1 h-4 font-mono text-[11px] text-muted-foreground">
					{generatingSteps[stepIndex]}
				</p>
			</div>
			<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
				<motion.div
					className="h-full w-1/3 rounded-full bg-gradient-ember"
					animate={{ x: ["-100%", "300%"] }}
					transition={{
						duration: 1.4,
						repeat: Number.POSITIVE_INFINITY,
						ease: "easeInOut",
					}}
				/>
			</div>
		</div>
	);
}

/** A build failed and there's no earlier version to fall back to. The error
    comes straight off the attempt row — honest, not prettified. */
function FailedPanel({ error }: { error: string | null }) {
	const { chatOpen, toggleChat } = useWorkspace();
	return (
		<div className="relative flex max-w-sm flex-col items-center gap-2.5 text-center">
			<span className="grid size-11 place-items-center rounded-full border border-destructive/30 bg-destructive/10">
				<AlertTriangle className="size-4 text-destructive" aria-hidden />
			</span>
			<p className="font-display font-semibold text-base">
				The page build failed
			</p>
			<p dir="auto" className="text-muted-foreground text-sm leading-relaxed">
				{error ?? "Something went wrong while generating your page."}
			</p>
			<p className="text-muted-foreground text-xs">
				Ask Wandit in the chat to try again.
			</p>
			{!chatOpen ? (
				<Button
					variant="secondary"
					size="sm"
					className="mt-1.5"
					onClick={toggleChat}
				>
					Open the chat
				</Button>
			) : null}
		</div>
	);
}

function EmptyPreview() {
	const { t } = useTranslation();
	const { chatOpen, toggleChat } = useWorkspace();
	return (
		<div className="relative flex flex-col items-center gap-2.5 text-center">
			<span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-card">
				<Spark className="size-4 text-primary/70" />
			</span>
			<p className="font-display font-semibold text-base">
				{t("workspace.page.emptyTitle")}
			</p>
			<p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
				{t("workspace.page.emptyBody")}
			</p>
			{!chatOpen ? (
				<Button
					variant="secondary"
					size="sm"
					className="mt-1.5"
					onClick={toggleChat}
				>
					{t("workspace.chat.expand")}
				</Button>
			) : null}
		</div>
	);
}
