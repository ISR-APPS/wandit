// The project index: the ledger header, one row for each project, and the cover preview.
// HeroSection renders it, so the list of work is the first thing a visitor sees.
// It keeps which row shows its cover. The rows report the pointer, the focus, and the taps.
import { useCallback, useRef, useState } from "react";
import { useT } from "~/shared/i18n";
import { PROJECTS, type ProjectId } from "../lib/projects";
import { LEDGER_LABEL, MONO } from "../lib/type-styles";
import { CoverPreview, type Point } from "./cover-preview";
import { IndexRow } from "./index-row";

/** The row whose cover shows, and how the cover shows. */
type ActiveCover = { projectId: ProjectId; isDocked: boolean };

/** The index under one ink rule. Only one cover shows at a time. */
export function ProjectIndex() {
	const { t } = useT();
	const [activeCover, setActiveCover] = useState<ActiveCover | null>(null);
	const indexRef = useRef<HTMLDivElement>(null);
	const pointerRef = useRef<Point>({ x: 0, y: 0 });
	const hideCover = useCallback(() => setActiveCover(null), []);
	const activeProject = PROJECTS.find(
		(project) => project.id === activeCover?.projectId,
	);

	return (
		<div ref={indexRef} className="border-foreground border-t">
			<div aria-hidden="true" className="sable-ledger-head">
				<span className={LEDGER_LABEL}>{t("hero.columnNumber")}</span>
				<span className={LEDGER_LABEL}>{t("hero.columnProject")}</span>
				<span className={LEDGER_LABEL}>{t("hero.columnSector")}</span>
				<span className={LEDGER_LABEL}>{t("hero.columnYear")}</span>
				<span className={LEDGER_LABEL}>{t("hero.columnRole")}</span>
				<span className={`${LEDGER_LABEL} text-end`}>
					{t("hero.columnScope")}
				</span>
				<span />
			</div>
			{PROJECTS.map((project) => (
				<IndexRow
					key={project.id}
					project={project}
					isActive={activeCover?.projectId === project.id}
					isArmed={
						activeCover?.projectId === project.id && activeCover.isDocked
					}
					pointerRef={pointerRef}
					onShow={(isDocked) =>
						setActiveCover({ projectId: project.id, isDocked })
					}
					onHide={hideCover}
				/>
			))}
			<div
				className={`${MONO} sable-fade flex flex-wrap justify-between gap-x-4 gap-y-1 pt-3.5 text-foreground/55 [--sable-i:9]`}
			>
				{/* A phone and a touch screen have no hover and no keyboard, so they get their own line. */}
				<span className="max-[860px]:hidden [@media(hover:none)]:hidden">
					{t("hero.footHover")}
				</span>
				<span className="min-[861px]:[@media(hover:hover)]:hidden">
					{t("hero.footTouch")}
				</span>
				<span>{t("hero.footCount")}</span>
			</div>
			{activeCover !== null && activeProject !== undefined && (
				<CoverPreview
					project={activeProject}
					isDocked={activeCover.isDocked}
					pointerRef={pointerRef}
					indexRef={indexRef}
					onDismiss={hideCover}
				/>
			)}
		</div>
	);
}
