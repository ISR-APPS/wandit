// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Between Steps",
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
		fold: "A Room That Folds",
		foldTime: "Friday evening",
		mainStage: "Main hall",
		foldBody:
			"A trio uses a length of cloth to turn an empty stage into a room.",
		weight: "Where Weight Goes",
		weightTime: "Saturday afternoon",
		workshop: "Workshop studio",
		weightBody:
			"An open movement session on balance, weight, and giving physical cues to a partner.",
		water: "Waterline",
		waterTime: "Saturday evening",
		waterBody:
			"A solo traces the space a body leaves behind as it moves through a narrow strip of light.",
		all: "All events",
		shows: "Performances",
		workshops: "Workshops",
		program: "Program",
		access: "Access and venues",
		discipline: "Contemporary dance festival",
		first: "Between",
		last: "Steps",
		heroSubtitle:
			"Two days of performances and open workshops across two stages.",
		see: "See the program",
		heroAlt: "Dancer in midair against red stage lights",
		accessBody:
			"The main hall has a step-free entrance. Tell the front desk if you need a seat with more space or plan to leave and return during a show.",
		email: "Email the access team",
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
