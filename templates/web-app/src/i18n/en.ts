// English dictionary. The source of truth for every user-facing string.
// French and Arabic must keep the same keys and the same tree shape.
export const en = {
	common: {
		appName: "Wandit App",
		save: "Save",
		signOut: "Sign out",
	},
	nav: {
		features: "Features",
		signIn: "Sign in",
	},
	landing: {
		heroTitle: "Your business, online in minutes",
		heroSubtitle:
			"A fast storefront in three languages, with its own database.",
		heroCta: "Get started",
		featuresTitle: "Everything you need",
		feature1Title: "Fast by default",
		feature1Body: "Static pages served from the edge, close to your customers.",
		feature2Title: "Your own database",
		feature2Body: "Every app gets its own database, ready from the first day.",
		feature3Title: "Three languages",
		feature3Body:
			"English, French, and Arabic with full right-to-left support.",
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
	app: {
		profileTitle: "Profile",
		fullName: "Full name",
		fullNamePlaceholder: "Your display name",
		savedBody: "Your profile was updated.",
		loadError: "Your profile did not load. Refresh the page.",
		saveError: "Your profile was not saved. Try again.",
	},
} as const;
