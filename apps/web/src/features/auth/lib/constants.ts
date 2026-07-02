// Flip to false once the real better-auth flow is wired; session.ts then
// delegates to authClient transparently.
export const MOCK_AUTH: boolean = true;

export const AUTH_COPY = {
	modalTitle: "Welcome to Wandit",
	modalSubtitle: "Sign in to generate, publish and track your pages.",
	googleButton: "Continue with Google",
	divider: "or",
	emailLabel: "Email",
	emailPlaceholder: "you@example.com",
	sendMagicLink: "Send magic link",
	sending: "Sending",
	sentTitle: "Check your inbox",
	sentBody: "We sent a sign-in link to",
	useDifferentEmail: "Use a different email",
	terms: "By continuing, you agree to our Terms of Service and Privacy Policy.",
	signIn: "Sign in",
	signOut: "Sign out",
	creditsLabel: "Credits",
} as const;
