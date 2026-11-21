// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Stillglow",
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
		sumo: "Fold pendant",
		sumoType: "Ceiling",
		sumoMaterial: "Paper and spun brass",
		sumoBody:
			"Layered paper softens the light above a dining table. The bottom opening leaves the surface below easy to see.",
		tilt: "Tilt sconce",
		tiltType: "Wall",
		tiltMaterial: "Brushed aluminum",
		tiltBody:
			"A shallow shade tilts away from the wall to cast a wide wash up a corridor or stair.",
		bank: "Bank floor light",
		bankType: "Floor",
		bankMaterial: "Ceramic and linen",
		bankBody:
			"A low, heavy base holds a linen shade beside a sofa. The switch sits on the cord.",
		studio: "Lighting studio",
		index: "Fixture index",
		trade: "Trade",
		heroTitle: "Light with a quiet presence.",
		heroSubtitle:
			"Sculptural fixtures that put soft light where a room needs it.",
		browse: "View the collection",
		heroAlt: "Glowing paper pendant over an oak table",
		material: "Paper, brass, warm light",
		indexBody: "Open a fixture for assembly and placement notes.",
		tradeTitle: "For architects and designers",
		tradeBody:
			"Request finish samples or talk through a fixture for your space.",
		email: "Contact the studio",
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
