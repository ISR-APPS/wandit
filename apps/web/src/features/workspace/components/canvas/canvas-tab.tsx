// The polymorphic canvas: preview stage rendering the active version in a
// sandboxed iframe (mobile frame by default), plus generating/empty states.

import { Button } from "@my-better-t-app/ui/components/button";
import { Skeleton } from "@my-better-t-app/ui/components/skeleton";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { Spark } from "@/components/logo";
import { getVersionPage } from "../../api/workspace.services";
import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";
import { CanvasToolbar } from "./canvas-toolbar";

const COPY = WORKSPACE_COPY.canvas;

export function CanvasTab() {
	const [reloadKey, setReloadKey] = useState(0);
	return (
		<div className="flex h-full min-h-0 flex-col">
			<CanvasToolbar onReload={() => setReloadKey((key) => key + 1)} />
			<div className="relative min-h-0 flex-1 overflow-hidden">
				<div aria-hidden className="absolute inset-0 bg-dots" />
				<PreviewStage reloadKey={reloadKey} />
			</div>
		</div>
	);
}

function PreviewStage({ reloadKey }: { reloadKey: number }) {
	const {
		activeVersion,
		project,
		viewport,
		statePending,
		isGenerating,
		generationPhase,
	} = useWorkspace();

	const html = useMemo(
		() =>
			activeVersion
				? getVersionPage(activeVersion.pageKey, project?.name).html
				: "",
		[activeVersion, project?.name],
	);

	if (statePending) {
		return (
			<div className="relative flex h-full items-center justify-center p-6">
				<Skeleton className="h-full max-h-[720px] w-[390px] max-w-full rounded-[2rem]" />
			</div>
		);
	}

	if (!activeVersion) {
		return (
			<div className="relative flex h-full items-center justify-center p-6">
				{isGenerating ? <GeneratingPanel /> : <EmptyCanvas />}
			</div>
		);
	}

	const mobile = viewport === "mobile";

	return (
		<div className="relative flex h-full items-center justify-center p-4 md:p-6">
			<motion.div
				layout
				transition={{ type: "spring", bounce: 0.14, duration: 0.55 }}
				className={cn(
					"relative flex min-h-0 overflow-hidden bg-white",
					mobile
						? "h-full max-h-[780px] w-[390px] max-w-full rounded-[2rem] border-[5px] border-foreground/80 shadow-2xl dark:border-border"
						: "h-full w-full max-w-[1440px] rounded-xl border border-border/70 shadow-xl",
				)}
			>
				<PreviewFrame
					key={`${activeVersion.id}-${reloadKey}-${viewport}`}
					html={html}
					title={`${project?.name ?? "Preview"} — v${activeVersion.number}`}
				/>
				{generationPhase === "building" ? (
					<div className="absolute inset-0 z-10 grid place-items-center bg-background/55 backdrop-blur-[2px]">
						<GeneratingPanel />
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

function GeneratingPanel() {
	const { pendingVersionNumber } = useWorkspace();
	const [stepIndex, setStepIndex] = useState(0);

	useEffect(() => {
		const id = window.setInterval(
			() => setStepIndex((index) => (index + 1) % COPY.generatingSteps.length),
			1400,
		);
		return () => window.clearInterval(id);
	}, []);

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
					{COPY.generatingTitle(pendingVersionNumber)}
				</p>
				<p className="mt-1 h-4 font-mono text-[11px] text-muted-foreground">
					{COPY.generatingSteps[stepIndex]}
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

function EmptyCanvas() {
	const { chatOpen, toggleChat } = useWorkspace();
	return (
		<div className="relative flex flex-col items-center gap-2.5 text-center">
			<span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-card">
				<Spark className="size-4 text-primary/70" />
			</span>
			<p className="font-display font-semibold text-base">{COPY.emptyTitle}</p>
			<p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
				{COPY.emptyBody}
			</p>
			{!chatOpen ? (
				<Button
					variant="secondary"
					size="sm"
					className="mt-1.5"
					onClick={toggleChat}
				>
					{WORKSPACE_COPY.chat.expand}
				</Button>
			) : null}
		</div>
	);
}
