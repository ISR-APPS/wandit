// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell`, `database`, and `table` hold the strings of the frame, the database gate, and DataTable. */
export const messages = {
	common: {
		appName: "Wandit App",
		save: "Save",
		retry: "Try again",
		language: "Language",
	},
	shell: {
		toggleSidebar: "Toggle sidebar",
		home: "Home",
		settings: "Settings",
	},
	database: {
		opening: "Opening your data…",
		errorTitle: "Your data did not open",
		errorBody:
			"The app did not change your saved data. An update of the app repairs this problem.",
		errorDetails: "Details for support",
	},
	home: {
		title: "Home",
		emptyTitle: "Give your app a name",
		emptyBody: "The name shows on this page. You can change it in Settings.",
		emptyAction: "Open settings",
		loadError: "Your data did not load.",
	},
	settings: {
		title: "Settings",
		description: "These settings stay on this computer.",
		businessName: "Business name",
		businessNamePlaceholder: "My business",
		saved: "Your settings were saved.",
		saveError: "Your settings were not saved. Try again.",
		loadError: "Your settings did not load.",
	},
	table: {
		search: "Search",
		previous: "Previous",
		next: "Next",
	},
} as const;
