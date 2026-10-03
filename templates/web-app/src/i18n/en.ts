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
		subtitle: "We email you a magic link. No password needed.",
		email: "Email",
		emailPlaceholder: "you@example.com",
		submit: "Send magic link",
		sending: "Sending…",
		sentTitle: "Check your email",
		sentBody: "Open the link in the email to finish signing in.",
		error: "Sign-in failed. Try again.",
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
