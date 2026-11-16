// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
// The groups from `site` to `footer` hold the home page of Clinique Lumia, a skin clinic. All of it is fictional content.
// " " is a no-break space: it keeps a number with its unit, for example "12 000" and "DZD".
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Clinique Lumia",
		save: "Save",
		retry: "Try again",
		signOut: "Sign out",
		language: "Language",
	},
	site: {
		metaTitle: "Clinique Lumia — dermatology and skin care in Hydra, Algiers",
		metaDescription:
			"Clinique Lumia: dermatology and aesthetic skin care in Hydra, Algiers. A precise diagnosis first, then measured care for your skin.",
		skipToContent: "Skip to the content",
		brand: "Clinique Lumia",
		brandHome: "Clinique Lumia, back to the top",
		navLabel: "Sections of the page",
		navCare: "Treatments",
		navRitual: "The ritual",
		navTeam: "The doctor",
		navContact: "Contact",
		menuOpen: "Open the menu",
		menuDescription:
			"The sections of the page, the telephone, and the booking.",
		phoneLabel: "Telephone",
		phoneDisplay: "+213 21 00 00 00",
		phoneHref: "tel:+21321000000",
		emailDisplay: "visits@clinique-lumia.example",
		emailHref:
			"mailto:visits@clinique-lumia.example?subject=Appointment%20request",
		badgeLicensed: "Licensed dermatology",
		badgeSince: "Since 2012",
		badgePlace: "Hydra, Algiers",
	},
	hero: {
		welcome: "Welcome — sit back, we take care of the rest.",
		titleStart: "Skin, in full",
		titleAccent: "light",
		titleEnd: ".",
		lead: "Dermatology and aesthetic care in Hydra. A diagnosis first, measured care after — your skin always has the last word.",
		badgesLabel: "Facts about the clinic",
		cta: "Book an appointment",
		portraitAlt:
			"A young woman with her eyes closed in warm, golden window light.",
		serumAlt:
			"A practitioner massages the temples of a client who lies wrapped in a towel.",
		handsAlt: "A drop of cream on the back of a hand, next to a ceramic jar.",
		ceramicsAlt:
			"Folded towels and ceramic bowls in a sunlit room, with a woman in profile.",
	},
	care: {
		badge: "Care in the light",
		title: "Treatments that listen to your skin.",
		intro:
			"Three treatments, each with its price and its time. Every one starts with a short look at your skin.",
		currency: "DZD",
		priceLabel: "Price",
		durationLabel: "Duration",
		facialBadge: "By appointment",
		facialTitle: "Éclat facial",
		facialBody:
			"A deep cleanse, a slow massage and a plumping mask. Your skin breathes again, simply.",
		facialPrice: "12 000",
		facialDuration: "1 h 15",
		facialAlt:
			"Hands apply cream to the cheek of a client who lies on a treatment bed.",
		serumBadge: "Made for you",
		serumTitle: "Serum and massage ritual",
		serumBody:
			"A serum chosen for your skin, applied in slow strokes along the face and the neck.",
		serumPrice: "9 500",
		serumDuration: "50 min",
		serumAlt:
			"A practitioner massages the temples of a client who lies wrapped in a towel.",
		consultBadge: "Diagnosis first",
		consultTitle: "Dermatology consultation",
		consultBody:
			"A full examination of your skin before anything else. Nothing is prescribed before we understand.",
		consultPrice: "4 000",
		consultDuration: "30 min",
		consultAlt: "A hand receives a drop of cream next to a small ceramic jar.",
	},
	ritual: {
		badge: "The ritual",
		title: "The Lumia ritual, in four steps.",
		step1Title: "The diagnosis",
		step1Body:
			"Twenty minutes to listen to your skin, your life and your habits.",
		step1Alt: "Hands examine the cheek of a client during the diagnosis.",
		step2Title: "The plan",
		step2Body: "A care plan written for you, with no step you do not need.",
		step2Alt:
			"A woman in a head towel rests near folded towels and ceramic bowls.",
		step3Title: "The care",
		step3Body: "Trained hands, measured products, and all the time it takes.",
		step3Alt:
			"A practitioner massages the temples of a client who lies wrapped in a towel.",
		step4Title: "The follow-up",
		step4Body: "Two weeks later, we look together at what your skin tells us.",
		step4Alt: "A drop of cream on the back of a hand.",
	},
	window: {
		caption: "Calm is part of the protocol",
		alt: "Towels, ceramic bowls and a woman in profile in the quiet light of the clinic.",
	},
	practitioner: {
		title: "The face behind the care.",
		name: "Dr Lina Meziane, dermatologist",
		bio: "Trained at the Algiers faculty of medicine, fifteen years between hospital wards and private practice. She opened Lumia in 2012 with one simple belief: skin heals better when you understand it.",
		quote: "“I do not promise you another skin. I take care of yours.”",
		badge: "Algiers medical council",
		alt: "Dr Lina Meziane in a cream linen jacket near a tall window, her face turned to the light.",
		factYearsValue: "15",
		factYearsLabel: "years of practice",
		factVisitValue: "30",
		factVisitLabel: "minutes for a first visit",
		factFollowValue: "14",
		factFollowLabel: "days to the follow-up",
	},
	contact: {
		title: "Book an appointment.",
		badge: "Booking",
		lead: "Call us, or write a short note. We find the right time with you.",
		stepsLabel: "What to tell us",
		step1: "Your full name and a telephone number.",
		step2: "The treatment you want, or “I do not know yet”.",
		step3: "The days and the times that suit you.",
		callCta: "Call the clinic",
		emailCta: "Write to us",
		reassurance:
			"We call you back within one working day. No waiting list, no reminder calls.",
		factsLabel: "Practical details",
		addressLabel: "Address",
		addressValue: "7 impasse des Lumières, Hydra, Algiers",
		hoursLabel: "Hours",
		hoursValue: "Saturday to Thursday, 9 am to 6 pm",
		emailLabel: "Email",
		photoAlt:
			"A client with her eyes closed during a quiet moment at Clinique Lumia.",
	},
	footer: {
		credentialsLabel: "Credentials of the clinic",
		copyright: "© Clinique Lumia, Hydra",
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
