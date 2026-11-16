// The cover that follows the pointer over the index, or docks at the bottom corner.
// ProjectIndex renders it while one row is active. It exists only in the browser, so the page is complete without it.
// It calls requestAnimationFrame to move the plate, and listens to the document for a tap outside the index.
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { useT } from "~/shared/i18n";
import type { Project } from "../lib/projects";
import { LEDGER_LABEL } from "../lib/type-styles";
import { Plate } from "./plate";

/** A pointer position in the viewport, in CSS pixels. */
export type Point = { x: number; y: number };

type CoverPreviewProps = {
	/** The project of the active row. */
	project: Project;
	/** True for keyboard focus, a first tap, and reduced motion: the plate sits at the bottom corner and does not move. */
	isDocked: boolean;
	/** The last pointer position over the index. The rows write it; the frame loop reads it. */
	pointerRef: RefObject<Point>;
	/** The index element. A tap outside it closes a docked cover. */
	indexRef: RefObject<HTMLElement | null>;
	/** Called when a tap outside the index closes the cover. */
	onDismiss: () => void;
};

// Each frame the plate covers 14% of the distance to the pointer, so it lags behind it.
const LAG = 0.14;
// The plate sits 26px to the side of the pointer and 20px below it.
const OFFSET: Point = { x: 26, y: 20 };
// The plate stays 12px inside each edge of the viewport.
const EDGE_GAP = 12;

/** The floating or docked cover of one project, with a mono caption bar under it. */
export function CoverPreview({
	project,
	isDocked,
	pointerRef,
	indexRef,
	onDismiss,
}: CoverPreviewProps) {
	const { t } = useT();
	const previewRef = useRef<HTMLDivElement>(null);

	// effect: requestAnimationFrame is a browser API. The loop moves the plate after the pointer before each paint.
	useLayoutEffect(() => {
		const preview = previewRef.current;
		if (isDocked || preview === null) {
			return;
		}
		const position = { ...pointerRef.current };
		let frame = 0;
		const move = () => {
			const target = pointerRef.current;
			position.x += (target.x - position.x) * LAG;
			position.y += (target.y - position.y) * LAG;
			const maxX = window.innerWidth - preview.offsetWidth - EDGE_GAP;
			const maxY = window.innerHeight - preview.offsetHeight - EDGE_GAP;
			const x = Math.min(Math.max(position.x + OFFSET.x, EDGE_GAP), maxX);
			const y = Math.min(Math.max(position.y + OFFSET.y, EDGE_GAP), maxY);
			preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			frame = window.requestAnimationFrame(move);
		};
		move();
		return () => {
			window.cancelAnimationFrame(frame);
			preview.style.transform = "";
		};
	}, [isDocked, pointerRef]);

	// effect: a pointerdown on the document is a browser event. A tap outside the index closes the docked cover.
	useEffect(() => {
		if (!isDocked) {
			return;
		}
		const closeOnOutsideTap = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				indexRef.current?.contains(event.target) !== true
			) {
				onDismiss();
			}
		};
		document.addEventListener("pointerdown", closeOnOutsideTap);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsideTap);
		};
	}, [isDocked, indexRef, onDismiss]);

	return (
		<div
			ref={previewRef}
			aria-hidden="true"
			className="sable-preview"
			data-docked={isDocked ? "" : undefined}
		>
			<div className="sable-preview-frame">
				<Plate project={project} aspectClassName="aspect-[3/2]" isDecorative />
			</div>
			<div className={`${LEDGER_LABEL} sable-preview-caption`}>
				{t(`projects.${project.id}.previewCaption`)}
			</div>
		</div>
	);
}
