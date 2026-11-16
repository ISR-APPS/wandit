/**
 * Types of the starter templates feature, from packages/contracts.
 * The catalog types come from the subpath: the contracts barrel does not export them.
 * Read by the services, the helpers, the components, and the pages of this feature.
 */

export type {
	CreateAppProjectFromStarterTemplateRequest,
	CreateAppProjectResponse,
} from "@wandit/contracts";
export type {
	StarterTemplate,
	StarterTemplateCategory,
	StarterTemplateKind,
} from "@wandit/contracts/v2/starter-templates";
