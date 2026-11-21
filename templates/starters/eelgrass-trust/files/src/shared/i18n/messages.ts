// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Eelgrass Trust",
		save: "Save",
		retry: "Try again",
		signOut: "Sign out",
		language: "Language",
	},
	nav: {
		features: "Features",
		signIn: "Sign in",
	},
	landing: {
		mapTitle: "Map the beds",
		mapBody:
			"Record the edges of existing meadows at low tide and return to the same sites each season.",
		restoreTitle: "Restore the shallows",
		restoreBody:
			"Start with the water and sediment. Use local shoots where a sheltered site can support their roots.",
		shareTitle: "Share the record",
		shareBody:
			"Publish field observations for stewardship groups, researchers, and anyone who works on the shore.",
		work: "The work",
		notes: "Field notes",
		volunteer: "Volunteer",
		heroAlt: "Eelgrass meadow under green coastal water",
		place: "Salish Sea coastal habitat",
		heroTitle: "The meadow beneath the tide.",
		explore: "Explore the work",
		workTitle: "Small plants. A living shoreline.",
		heroSubtitle:
			"Eelgrass shelters juvenile fish and slows water near the shore. The trust studies existing beds and restores sites that can support them.",
		notesLabel: "Field note: survey day",
		notesTitle: "Read the shore at low tide.",
		notesBody:
			"The edge of a meadow is easy to miss from the beach. From a fixed point, record the time, the tide, and the first shoots you see. Keep your feet out of the beds.",
		checklist: "Field checklist",
		checklistBody:
			"Bring a tide table, waterproof notes, and a camera. Take one wide photograph and repeat it on each visit.",
		footer: "Join a shore survey.",
		email: "Email the field team",
	},
	login: {
		title: "Sign in",
		subtitle: "Use your email and password.",
		signUpTitle: "Create an account",
		signUpSubtitle: "Your account works at once.",
		email: "Email",
		emailPlaceholder: "you@example.com",
		password: "Password",
		confirmPassword: "Confirm password",
		submit: "Sign in",
		signUpSubmit: "Create account",
		sending: "Please wait…",
		toSignUp: "No account yet? Create one",
		toSignIn: "Already have an account? Sign in",
		passwordMismatch: "The two passwords do not match.",
		error: "Sign-in failed. Check your email and password.",
		signUpError:
			"Sign-up failed. Try again, or sign in if you already have an account.",
	},
	profile: {
		title: "Profile",
		fullName: "Full name",
		fullNamePlaceholder: "Your display name",
		saved: "Your profile was updated.",
		loadError: "Your profile did not load. Check the connection and try again.",
		saveError: "Your profile was not saved. Try again.",
	},
	shell: {
		toggleSidebar: "Toggle sidebar",
		profile: "Profile",
		signOutError: "Sign-out failed. Try again.",
	},
	table: {
		search: "Search",
		previous: "Previous",
		next: "Next",
	},
} as const;
