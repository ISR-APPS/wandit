// One row of the project index: the number, the name, and the ledger values of a project.
// ProjectIndex renders one for each project. The row is a link to the case study or to the cover on the wall.
// landing.css places the cells: seven columns on a wide screen, two lines on a phone.
import type { RefObject } from "react";
import { useT } from "~/shared/i18n";
import type { Project } from "../lib/projects";
import { MONO, ROW_NAME } from "../lib/type-styles";
import type { Point } from "./cover-preview";

type IndexRowProps = {
	project: Project;
	/** True while the cover of this row shows. The row then keeps its accent state. */
	isActive: boolean;
	/** True while the cover of this row is docked. On a touch screen the next tap then follows the link. */
	isArmed: boolean;
	/** The last pointer position over the index, for the cover preview. */
	pointerRef: RefObject<Point>;
	/** Shows the cover of this row, docked or floating. */
	onShow: (isDocked: boolean) => void;
	/** Hides the cover. */
	onHide: () => void;
};

/** A link row. The pointer makes its cover float, the keyboard docks it, and a first tap docks it on a touch screen. */
export function IndexRow({
	project,
	isActive,
	isArmed,
	pointerRef,
	onShow,
	onHide,
}: IndexRowProps) {
	const { t } = useT();
	return (
		<a
			href={`#${project.targetId}`}
			className="sable-index-row sable-row"
			data-active={isActive ? "" : undefined}
			onPointerEnter={(event) => {
				if (event.pointerType !== "mouse") {
					return;
				}
				pointerRef.current = { x: event.clientX, y: event.clientY };
				// Reduced motion: the cover shows at once in its docked place and does not follow the pointer.
				onShow(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
			}}
			onPointerMove={(event) => {
				if (event.pointerType === "mouse") {
					pointerRef.current = { x: event.clientX, y: event.clientY };
				}
			}}
			onPointerLeave={(event) => {
				// A row with keyboard focus keeps its docked cover when the pointer leaves.
				if (
					event.pointerType === "mouse" &&
					!event.currentTarget.matches(":focus-visible")
				) {
					onHide();
				}
			}}
			onFocus={(event) => {
				// Only keyboard focus docks the cover. A click also focuses the link, and must not.
				if (event.currentTarget.matches(":focus-visible")) {
					onShow(true);
				}
			}}
			onBlur={onHide}
			onClick={(event) => {
				// A touch screen has no hover: the first tap docks the cover, and the second tap follows the link.
				if (window.matchMedia("(hover: none)").matches && !isArmed) {
					event.preventDefault();
					onShow(true);
					return;
				}
				onHide();
			}}
		>
			<span className="sable-index-num sable-mono text-[12px] text-foreground/30">
				{project.number}
			</span>
			<span className={`sable-index-name ${ROW_NAME}`}>
				{t(`projects.${project.id}.name`)}
			</span>
			<span className={`sable-index-sector ${MONO} text-foreground/80`}>
				{t(`projects.${project.id}.sector`)}
			</span>
			<span className={`sable-index-year ${MONO} text-foreground/55`}>
				{project.year}
			</span>
			<span className={`sable-index-role ${MONO} text-foreground/80`}>
				{t(`projects.${project.id}.role`)}
			</span>
			<span className={`sable-index-scope ${MONO} text-foreground/80`}>
				{t(`projects.${project.id}.scope`)}
			</span>
			<span
				aria-hidden="true"
				className="sable-index-arrow text-[19px] text-foreground/30 rtl:-scale-x-100"
			>
				→
			</span>
		</a>
	);
}
