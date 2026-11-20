// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "First Crack",
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
		coffeeLight: "Daybreak",
		coffeeLightNotes: "Orange blossom, honey, and lemon peel",
		coffeeLightGuide:
			"A light roast for a clean, bright pour-over. Grind medium-fine and let it draw down completely.",
		coffeeMedium: "House Current",
		coffeeMediumNotes: "Toffee, red apple, and cocoa",
		coffeeMediumGuide:
			"A balanced roast for the batch brewer. It stays sweet as the cup cools.",
		coffeeDark: "Late Shift",
		coffeeDarkNotes: "Cocoa nib, walnut, and baked cherry",
		coffeeDarkGuide:
			"A fuller roast with enough body for milk drinks or a short espresso.",
		coffee: "Coffee",
		brew: "Brew guide",
		heroTitle: "Good to the last pour.",
		heroSubtitle:
			"Small-batch coffee for weekday cups, long mornings, and everything you brew in between.",
		heroAlt: "Coffee bags and roasted beans on the roastery counter",
		finder: "Find your coffee",
		finderBody: "Start with the flavors you look for in the cup.",
		notes: "Tasting notes",
		brewTitle: "Brew it your way.",
		filterTitle: "Pour-over",
		filterBody:
			"Use 20 g of coffee and 320 g of water. Wet the grounds first and wait 30 seconds. Add the remaining water in slow circles.",
		pressTitle: "French press",
		pressBody:
			"Use 30 g of coarse coffee and 500 g of water. Steep for four minutes, stir, and press gently.",
		email: "Ask about wholesale coffee",
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
