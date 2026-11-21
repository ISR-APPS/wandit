// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Housecall",
		save: "Save",
		retry: "Try again",
		signOut: "Sign out",
		language: "Language",
	},
	login: {
		title: "Sign in",
		subtitle: "Use your email and password.",
		signUpTitle: "Create an account",
		signUpSubtitle: "Use your email and choose a password.",
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
		emailWait: "Too many emails for now. Wait a few minutes, then try again.",
		codeTitle: "Confirm your email",
		codeSubtitle: "Enter the 6-digit code from the email for this address.",
		code: "Code",
		codeSubmit: "Confirm",
		codeError: "The code did not work. Check the code, or send a new one.",
		codeResend: "Send a new code",
		codeResent: "If this address waits for a code, a new code is on its way.",
		codeResendError: "The new code was not sent. Try again.",
		codeNoEmail: "No email? This address can already have an account. Sign in.",
		useOtherEmail: "Use another email",
		passwordSaveError:
			"Your email is confirmed, but your password was not saved. Try again.",
		sessionChanged:
			"Your email is confirmed, but your session in this browser ended. Sign in again.",
	},
	profile: {
		title: "Profile",
		fullName: "Full name",
		fullNamePlaceholder: "Your display name",
		saved: "Your profile was updated.",
		loadError: "Your profile did not load. Check the connection and try again.",
		saveError: "Your profile was not saved. Try again.",
	},
	appAccess: {
		pendingTitle: "Your account waits for approval",
		refusedTitle: "Your account has no access to this app",
		askOwner:
			"Only the owner of this app can give you access. Ask the owner, then check again.",
		checkAgain: "Check again",
		checkError: "The app did not open. Check the connection and try again.",
		requests: "Access requests",
		requestsHint: "Approve only the people that you know.",
		requestsEmpty: "No other account yet. Each person who signs up shows here.",
		requestsError: "The list did not load. Check the connection and try again.",
		decideError: "The change was not saved. Try again.",
		approve: "Approve",
		refuse: "Refuse",
		remove: "Remove",
		statusPending: "Waiting",
		statusApproved: "Approved",
		statusRefused: "No access",
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
