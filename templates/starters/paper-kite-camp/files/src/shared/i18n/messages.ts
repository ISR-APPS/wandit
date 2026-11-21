// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Paper Kite",
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
		monday: "Monday",
		mondayArt: "Paint a place",
		mondayNote: "Mix a new color for every sound outside.",
		tuesday: "Tuesday",
		tuesdayArt: "Make a print",
		tuesdayNote: "Cut, roll, and print a pattern in two inks.",
		wednesday: "Wednesday",
		wednesdayArt: "Build a creature",
		wednesdayNote: "Join cardboard parts with paper tabs.",
		thursday: "Thursday",
		thursdayArt: "Tell a tiny story",
		thursdayNote: "Fold an eight-page book from one sheet.",
		friday: "Friday",
		fridayArt: "Open the studio",
		fridayNote: "Put the week's work on the wall for families.",
		schedule: "The week",
		info: "For families",
		register: "Ask about a place",
		tag: "Summer art camp · ages 7–13",
		heroTitle: "Make a glorious mess.",
		heroSubtitle:
			"A week of paint, paper, and projects to bring home. You bring curiosity. We bring aprons.",
		seeWeek: "See what we make",
		heroAlt: "Campers cut and paint paper shapes at an outdoor worktable",
		weekTitle: "Five days in the studio.",
		weekIntro:
			"A new material each morning and time to finish projects after lunch.",
		familyTitle: "For families",
		familyIntro:
			"Juniors work in small groups. Older campers can plan longer projects and work with more tools.",
		bring: "What should we bring?",
		bringBody:
			"Pack lunch, a water bottle, and clothes that can get paint on them. All materials are in the studio.",
		experience: "Do campers need art experience?",
		experienceBody:
			"The workshop leader shows each technique first. Campers choose how to use it on their own project.",
		footer: "Plan a week with us.",
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
