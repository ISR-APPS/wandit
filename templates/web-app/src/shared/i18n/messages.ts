// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Wandit App",
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
		heroTitle: "Your business, online in minutes",
		heroSubtitle: "A fast website with its own database and sign-in.",
		heroCta: "Get started",
		featuresTitle: "Everything you need",
		feature1Title: "Fast by default",
		feature1Body: "Static pages served from the edge, close to your customers.",
		feature2Title: "Your own database",
		feature2Body: "Every app gets its own database, ready from the first day.",
		feature3Title: "Accounts built in",
		feature3Body: "Visitors sign up and sign in with an email and a password.",
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
