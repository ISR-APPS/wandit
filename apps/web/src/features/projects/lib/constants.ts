// All user-facing copy for the projects feature (centralized so a locale
// swap is cheap) + grid config.

export const GRID_SKELETON_COUNT = 6;
export const PROJECT_NAME_MAX_LENGTH = 60;

export const PROJECTS_COPY = {
	headerTitle: "Projects",
	promptHeading: "What will you launch today?",

	toolbarTitle: "Your projects",
	searchPlaceholder: "Search projects…",
	filterAll: "All",
	filterPublished: "Published",
	filterDrafts: "Drafts",

	emptyTitle: "No projects yet",
	emptyBody: "No projects yet — describe your first page above.",
	emptyCta: "Write your first prompt",
	noResultsTitle: "No matching projects",
	noResultsBody: (query: string) =>
		query
			? `Nothing matches "${query}". Try another search.`
			: "Nothing matches this filter.",
	clearFilters: "Clear filters",

	statusDraft: "Draft",
	statusPublishing: "Publishing",
	statusPublished: "Published",
	leadsSuffix: "leads",
	publishedDomain: ".wandit.app",

	menuOpen: "Open",
	menuViewLive: "View live",
	menuViewLiveMock: "Mock",
	menuRename: "Rename",
	menuDelete: "Delete",
	cardMenuLabel: "Project actions",

	renameTitle: "Rename project",
	renameDescription: "The published page keeps its slug.",
	renameLabel: "Project name",
	renameSave: "Save",
	renameCancel: "Cancel",
	renameSuccess: "Project renamed",

	deleteTitle: "Delete project?",
	deleteDescription: (name: string) =>
		`"${name}" and its leads will be gone for good. This cannot be undone.`,
	deleteConfirm: "Delete",
	deleteCancel: "Cancel",
	deleteSuccess: "Project deleted",

	createSuccess: (name: string) => `"${name}" is ready`,

	sidebarGroupWorkspace: "Workspace",
	sidebarGroupResources: "Resources",
	sidebarSoon: "Soon",
	sidebarCreditsLabel: "Credits",
	sidebarTopUp: "Top up — soon",
} as const;
