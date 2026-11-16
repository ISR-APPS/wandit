// The views of the Projects page: live, at risk, delivered, or all, and the test of each view.
// The Projects page builds its tabs and counts from this list, so a count always equals its rows.
import type { ProjectSummary } from "~/features/studio";

/** The tabs of the Projects page, in order. */
export const PROJECT_VIEWS = ["live", "at_risk", "delivered", "all"] as const;

/** One tab. Its label is `projects.views.<view>`. */
export type ProjectView = (typeof PROJECT_VIEWS)[number];

/** True when the project belongs in the view. "At risk" holds over-budget projects too. */
export function isInView(project: ProjectSummary, view: ProjectView): boolean {
	switch (view) {
		case "live":
			return project.isLive;
		case "at_risk":
			return project.health === "at_risk" || project.health === "over_budget";
		case "delivered":
			return !project.isLive;
		case "all":
			return true;
	}
}
