// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Switchback",
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
		jersey: "Climb jersey",
		jerseyUse: "Light layer",
		jerseyBody:
			"A light knit for sustained climbs. Three rear pockets keep food and tools within reach.",
		vest: "Summit vest",
		vestUse: "Wind layer",
		vestBody:
			"A wind-resistant front and open mesh back. Fold it into a jersey pocket before the climb.",
		bib: "Traverse bib",
		bibUse: "Endurance",
		bibBody:
			"Wide straps and a low-profile leg band for long days in the saddle.",
		collection: "The kit",
		fit: "Fit guide",
		heroAlt: "Riders follow a winding road into the Alps",
		route: "Route: high alpine passes",
		grade: "Field kit for exposed roads",
		label: "Light layers. Long routes.",
		heroTitle: "Beyond the last bend.",
		heroSubtitle: "Three layers for changing weather on the same ride.",
		fitIntro:
			"Measure over a base layer. Keep the tape flat and let it touch without pulling tight.",
		chest: "Chest and shoulders",
		chestBody:
			"Measure around the widest part of your chest. A riding jersey fits close when you lean over the bars.",
		waist: "Waist and hips",
		waistBody:
			"Use your natural waist and the widest part of your hips. If you are between sizes, write to us with both measurements.",
		email: "Ask about fit or availability",
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
