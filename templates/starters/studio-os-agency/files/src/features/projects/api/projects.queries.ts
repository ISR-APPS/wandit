// Reads of projects: the list with spend and health, and the detail of one project.
// The Projects routes, the overview, and the Clients page prefetch them in their loaders.
// Each queryFn returns the sample rows today. A later turn replaces its body with a Supabase read.
import { queryOptions } from "@tanstack/react-query";
import { getStudioData, summarizeProjects } from "~/features/studio";
import { buildProjectDetail } from "../lib/project-detail";

/** Every project with its client, its lead, its spend, its phase, and its health, in catalog order. */
export function projectsQueryOptions() {
	return queryOptions({
		queryKey: ["projects", "list"],
		queryFn: async () => summarizeProjects(getStudioData()),
	});
}

/** One project with its deliverables, people, invoices, and burn series. null for an unknown id. */
export function projectQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: ["projects", "detail", projectId],
		queryFn: async () => buildProjectDetail(getStudioData(), projectId),
	});
}
