// Assets "Canvas" view: a fixed coordinate plane that mirrors the prototype's
// scaled artboard, with ephemeral drag/selection state for mock assets.

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import {
	Frame,
	Image as ImageIcon,
	Minus,
	MousePointer2,
	Plus,
	Type,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { PageVersion } from "../../api/dto";
import { ASSETS_CANVAS_BOARD, ASSETS_CANVAS_ZOOM } from "../../lib/constants";
import {
	type AssetsCanvasItemLayout,
	createAssetsCanvasLayout,
	createAssetsCanvasLayouts,
} from "../../lib/helpers";
import { useWorkspace } from "../../lib/store";
import { AssetCardFace } from "./asset-card";

type DragState = {
	id: string;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
};

type PanOffset = {
	x: number;
	y: number;
};

type PanState = {
	startX: number;
	startY: number;
	originX: number;
	originY: number;
};

function isSpaceKey(event: KeyboardEvent) {
	return event.code === "Space" || event.key === " ";
}

function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return false;
	if (target.closest("input, textarea, select")) return true;
	return target instanceof HTMLElement && target.isContentEditable;
}

function clampPanOffset(offset: PanOffset, scale: number, viewport: DOMRect) {
	const scaledWidth = ASSETS_CANVAS_BOARD.WIDTH * scale;
	const scaledHeight = ASSETS_CANVAS_BOARD.HEIGHT * scale;
	const minX = ASSETS_CANVAS_BOARD.PAN_OVERLAP - scaledWidth;
	const maxX = viewport.width - ASSETS_CANVAS_BOARD.PAN_OVERLAP;
	const minY = ASSETS_CANVAS_BOARD.PAN_OVERLAP - scaledHeight;
	const maxY = viewport.height - ASSETS_CANVAS_BOARD.PAN_OVERLAP;

	return {
		x: Math.min(maxX, Math.max(minX, offset.x)),
		y: Math.min(maxY, Math.max(minY, offset.y)),
	};
}

function CanvasToolButton({
	label,
	active,
	children,
}: {
	label: string;
	active?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					aria-pressed={active}
					className={cn(
						"grid size-[34px] place-items-center rounded-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground dark:focus-visible:ring-offset-background",
						active
							? "bg-primary text-primary-foreground"
							: "text-background/70 hover:bg-background/10 hover:text-background dark:text-foreground/70 dark:hover:bg-foreground/10 dark:hover:text-foreground",
					)}
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">{label}</TooltipContent>
		</Tooltip>
	);
}

function CanvasToolbar() {
	const { t } = useTranslation();

	return (
		<div
			className="absolute bottom-[18px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-[14px] bg-foreground p-1.5 text-background shadow-[0_10px_34px_rgba(0,0,0,.28)] dark:bg-background dark:text-foreground"
			onPointerDown={(event) => event.stopPropagation()}
		>
			<CanvasToolButton label={t("workspace.assets.toolSelect")} active>
				<MousePointer2 className="size-[15px]" />
			</CanvasToolButton>
			<CanvasToolButton label={t("workspace.assets.toolFrame")}>
				<Frame className="size-[15px]" />
			</CanvasToolButton>
			<CanvasToolButton label={t("workspace.assets.toolImage")}>
				<ImageIcon className="size-[15px]" />
			</CanvasToolButton>
			<CanvasToolButton label={t("workspace.assets.toolText")}>
				<Type className="size-[15px]" />
			</CanvasToolButton>
			<div
				aria-hidden
				className="mx-[3px] h-[18px] w-px bg-background/15 dark:bg-foreground/15"
			/>
			<button
				type="button"
				className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] bg-primary px-3 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground dark:ring-offset-background"
			>
				<Plus className="size-[13px]" />
				{t("workspace.assets.generate")}
			</button>
		</div>
	);
}

function ZoomPill({
	zoomPercent,
	onZoomIn,
	onZoomOut,
}: {
	zoomPercent: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
}) {
	const { t } = useTranslation();
	const canZoomOut = zoomPercent > ASSETS_CANVAS_ZOOM.MIN;
	const canZoomIn = zoomPercent < ASSETS_CANVAS_ZOOM.MAX;

	return (
		<div
			className="absolute end-[18px] bottom-5 z-30 flex items-center gap-px rounded-[10px] border bg-card p-1 shadow-[0_4px_14px_rgba(26,25,23,.10)]"
			onPointerDown={(event) => event.stopPropagation()}
		>
			<button
				type="button"
				aria-label={t("workspace.assets.zoomOut")}
				disabled={!canZoomOut}
				onClick={onZoomOut}
				className="grid size-7 place-items-center rounded-[7px] text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40"
			>
				<Minus className="size-[15px]" />
			</button>
			<span className="min-w-[42px] text-center font-mono text-[11.5px] text-foreground tabular-nums">
				{zoomPercent}%
			</span>
			<button
				type="button"
				aria-label={t("workspace.assets.zoomIn")}
				disabled={!canZoomIn}
				onClick={onZoomIn}
				className="grid size-7 place-items-center rounded-[7px] text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40"
			>
				<Plus className="size-[15px]" />
			</button>
		</div>
	);
}

export function AssetsCanvasBoard({ versions }: { versions: PageVersion[] }) {
	const { project } = useWorkspace();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [zoomPercent, setZoomPercent] = useState<number>(
		ASSETS_CANVAS_ZOOM.DEFAULT,
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
	const [isSpacePanArmed, setIsSpacePanArmed] = useState(false);
	const [isPanning, setIsPanning] = useState(false);
	const [layouts, setLayouts] = useState<
		Record<string, AssetsCanvasItemLayout>
	>(() => createAssetsCanvasLayouts(versions));
	const dragRef = useRef<DragState | null>(null);
	const panRef = useRef<PanState | null>(null);
	const panOffsetRef = useRef(panOffset);
	const spacePanArmedRef = useRef(false);
	const zoomScale = zoomPercent / 100;
	const zoomScaleRef = useRef(zoomScale);

	useEffect(() => {
		zoomScaleRef.current = zoomScale;
	}, [zoomScale]);

	useEffect(() => {
		setLayouts((current) => {
			let changed = false;
			const next: Record<string, AssetsCanvasItemLayout> = {};

			for (const version of versions) {
				const existing = current[version.id];
				if (existing) {
					next[version.id] = existing;
					continue;
				}
				next[version.id] = createAssetsCanvasLayout(
					version,
					Object.keys(next).length,
				);
				changed = true;
			}

			if (Object.keys(current).length !== Object.keys(next).length) {
				changed = true;
			}

			return changed ? next : current;
		});
	}, [versions]);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			const pan = panRef.current;
			if (pan) {
				event.preventDefault();
				const viewport = containerRef.current?.getBoundingClientRect();
				if (!viewport) return;

				const nextOffset = clampPanOffset(
					{
						x: pan.originX + event.clientX - pan.startX,
						y: pan.originY + event.clientY - pan.startY,
					},
					zoomScaleRef.current,
					viewport,
				);

				if (
					nextOffset.x === panOffsetRef.current.x &&
					nextOffset.y === panOffsetRef.current.y
				) {
					return;
				}

				panOffsetRef.current = nextOffset;
				setPanOffset(nextOffset);
				return;
			}

			const drag = dragRef.current;
			if (!drag) return;

			event.preventDefault();
			const scale = zoomScaleRef.current;
			const x = drag.originX + (event.clientX - drag.startX) / scale;
			const y = drag.originY + (event.clientY - drag.startY) / scale;

			setLayouts((current) => {
				const layout = current[drag.id];
				if (!layout) return current;
				return {
					...current,
					[drag.id]: {
						...layout,
						x,
						y,
					},
				};
			});
		};

		const endDrag = () => {
			if (panRef.current) {
				panRef.current = null;
				setIsPanning(false);
			}

			if (dragRef.current) {
				dragRef.current = null;
				setDraggingId(null);
			}
		};

		window.addEventListener("pointermove", handlePointerMove, {
			passive: false,
		});
		window.addEventListener("pointerup", endDrag);
		window.addEventListener("pointercancel", endDrag);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", endDrag);
			window.removeEventListener("pointercancel", endDrag);
		};
	}, []);

	useEffect(() => {
		const disarmSpacePan = () => {
			spacePanArmedRef.current = false;
			setIsSpacePanArmed(false);
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				dragRef.current = null;
				panRef.current = null;
				setDraggingId(null);
				setIsPanning(false);
				setSelectedId(null);
				return;
			}

			if (!isSpaceKey(event) || isEditableTarget(event.target)) return;

			event.preventDefault();
			if (event.repeat) return;

			spacePanArmedRef.current = true;
			setIsSpacePanArmed(true);
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			if (!isSpaceKey(event)) return;
			if (!isEditableTarget(event.target)) {
				event.preventDefault();
			}
			disarmSpacePan();
		};

		const handleWindowBlur = () => {
			disarmSpacePan();
			panRef.current = null;
			setIsPanning(false);
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("blur", handleWindowBlur);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, []);

	const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;

		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		dragRef.current = null;
		setDraggingId(null);
		panRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			originX: panOffsetRef.current.x,
			originY: panOffsetRef.current.y,
		};
		setIsPanning(true);
	};

	const handleSurfacePointerDown = (
		event: React.PointerEvent<HTMLDivElement>,
	) => {
		if (spacePanArmedRef.current) {
			startPan(event);
			return;
		}

		setSelectedId(null);
	};

	const startDrag = (
		versionId: string,
		event: React.PointerEvent<HTMLDivElement>,
	) => {
		if (spacePanArmedRef.current) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;

		const layout = layouts[versionId];
		if (!layout) return;

		event.preventDefault();
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		setSelectedId(versionId);
		setDraggingId(versionId);
		dragRef.current = {
			id: versionId,
			startX: event.clientX,
			startY: event.clientY,
			originX: layout.x,
			originY: layout.y,
		};
	};

	const zoomOut = () =>
		setZoomPercent((value) =>
			Math.max(ASSETS_CANVAS_ZOOM.MIN, value - ASSETS_CANVAS_ZOOM.STEP),
		);
	const zoomIn = () =>
		setZoomPercent((value) =>
			Math.min(ASSETS_CANVAS_ZOOM.MAX, value + ASSETS_CANVAS_ZOOM.STEP),
		);
	const panCursorClass = isPanning ? "cursor-grabbing" : "cursor-grab";

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative h-full min-h-0 overflow-hidden bg-muted/40",
				(isSpacePanArmed || isPanning) && panCursorClass,
			)}
			onPointerDown={handleSurfacePointerDown}
		>
			<div
				aria-hidden
				className="absolute inset-0 bg-dots [-webkit-mask-image:none] [background-size:22px_22px] [mask-image:none]"
			/>

			<div
				className="absolute top-0 left-0"
				style={{
					width: ASSETS_CANVAS_BOARD.WIDTH,
					height: ASSETS_CANVAS_BOARD.HEIGHT,
					transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
					transformOrigin: "0 0",
				}}
			>
				{versions.map((version) => {
					const layout = layouts[version.id];
					if (!layout) return null;

					const isSelected = selectedId === version.id;
					const isDragging = draggingId === version.id;

					return (
						<div
							key={version.id}
							className={cn(
								"absolute touch-none select-none",
								isSpacePanArmed || isPanning
									? panCursorClass
									: isDragging
										? "cursor-grabbing"
										: "cursor-grab",
							)}
							style={{
								left: layout.x,
								top: layout.y,
								width: layout.width,
								zIndex: isSelected ? 20 : 1,
							}}
							onPointerDown={(event) => startDrag(version.id, event)}
						>
							<div
								className={cn(
									"h-full overflow-hidden rounded-lg bg-card shadow-[0_4px_18px_rgba(26,25,23,.14),0_0_0_1px_rgba(26,25,23,.06)] transition-[box-shadow,transform] duration-150",
									isSelected &&
										"ring-2 ring-ring ring-offset-2 ring-offset-background",
								)}
								style={{ height: layout.height }}
							>
								<AssetCardFace
									version={version}
									thumbnailSeed={project?.thumbnailSeed ?? 7}
									className="h-full"
								/>
							</div>
							<div
								dir="auto"
								className="mt-1.5 truncate px-0.5 font-mono text-[9.5px] text-muted-foreground"
								title={version.label}
							>
								{version.label}
							</div>
						</div>
					);
				})}
			</div>

			<CanvasToolbar />
			<ZoomPill
				zoomPercent={zoomPercent}
				onZoomIn={zoomIn}
				onZoomOut={zoomOut}
			/>
		</div>
	);
}
