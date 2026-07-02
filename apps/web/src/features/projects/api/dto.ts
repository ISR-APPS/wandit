// Request/response types for this feature's api layer. Source of truth is
// packages/contracts — these are derived re-exports (z.infer), never
// redeclared here.

export type {
	CreateProjectBody,
	CreateProjectResponse,
	Project,
	ProjectStatus,
	UpdateProjectBody,
} from "@wandit/contracts";
