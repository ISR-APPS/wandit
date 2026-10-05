// The source dictionary: every user-facing string of the app, in the default language.
// The template ships it in English. A second language file keeps the same keys and tree.
// `{name}` in a message is a parameter: t("home.greeting", { name }).
export const messages = {
	common: {
		retry: "Try again",
		save: "Save",
		close: "Close",
		loadError: "This did not load. Check your connection and try again.",
	},
	tabs: {
		home: "Home",
		account: "Account",
	},
	home: {
		title: "Welcome",
		greeting: "Hi, {name}",
		subtitle: "This app runs on iPhone, Android, and the web.",
		accountTitle: "Your account",
		accountSignedOut:
			"Open the Account tab to sign in and keep your profile on every device.",
		accountSignedIn: "Open the Account tab to change your name.",
	},
	account: {
		title: "Account",
		signedOutTitle: "You are not signed in",
		signedOutBody: "Sign in to keep your profile on every device.",
		editProfile: "Edit profile",
		editProfileHint: "Your name",
		language: "Language",
		signOutError: "You are still signed in. Try again.",
	},
	profile: {
		noName: "No name yet",
		editTitle: "Edit profile",
		nameLabel: "Full name",
		namePlaceholder: "Your name",
		nameError: "Enter a name of 1 to 80 characters.",
		saveError: "Your name is not saved. Try again.",
	},
	auth: {
		signInTitle: "Sign in",
		signUpTitle: "Create account",
		email: "Email",
		password: "Password",
		confirmPassword: "Confirm password",
		signIn: "Sign in",
		signUp: "Create account",
		signOut: "Sign out",
		toSignUp: "No account yet? Create one",
		toSignIn: "Already have an account? Sign in",
		errors: {
			email: "Enter a valid email address.",
			passwordRequired: "Enter your password.",
			passwordShort: "Use at least 8 characters.",
			passwordsDiffer: "Enter the same password again.",
			wrongCredentials: "Wrong email or password.",
			emailTaken: "An account with this email exists. Sign in instead.",
			weakPassword: "Choose a stronger password.",
			general: "Something went wrong. Try again.",
		},
	},
} as const;
