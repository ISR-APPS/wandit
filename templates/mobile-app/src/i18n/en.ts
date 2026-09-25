// English dictionary. The source of truth for every user-facing string.
// French and Arabic must keep the same keys and the same tree shape.
export const en = {
	common: {
		appName: "My App",
		back: "Back",
		retry: "Try again",
	},
	home: {
		title: "Welcome",
		subtitle: "This app runs on iPhone, Android, and the web.",
		languageTitle: "Language",
		openProfiles: "Open the profiles list",
	},
	profiles: {
		title: "Profiles",
		empty: "No profile to show. Your profile appears after you sign in.",
		loadError: "The list did not load.",
		unnamed: "No name yet",
	},
} as const;
