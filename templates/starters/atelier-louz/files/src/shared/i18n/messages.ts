// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/**
 * The default-language dictionary. `site` to `footer` hold the Atelier Louz home page.
 * `shell` and `table` hold the strings of the app shell and DataTable.
 */
export const messages = {
	common: {
		appName: "Atelier Louz",
		save: "Save",
		retry: "Try again",
		signOut: "Sign out",
		language: "Language",
	},
	site: {
		metaTitle: "Atelier Louz — interior architecture, Algiers",
		metaDescription:
			"Atelier Louz designs apartments, villas, and workplaces in Algiers around Mediterranean light and local materials.",
		brand: "Atelier Louz",
		homeLink: "Atelier Louz, back to the top",
		phoneDisplay: "021 00 00 00",
		phoneHref: "tel:+21321000000",
		email: "atelier@louz.example",
		emailHref:
			"mailto:atelier@louz.example?subject=A%20visit%20from%20Atelier%20Louz",
		addressLine: "9, impasse des Potiers",
		addressCity: "El Biar, Algiers",
		hours: "Sunday to Thursday, 9 am to 6 pm, by appointment",
	},
	nav: {
		label: "Sections",
		materials: "Materials",
		projects: "Projects",
		method: "Method",
		contact: "Contact",
		openMenu: "Open the menu",
		closeMenu: "Close the menu",
		menuTitle: "Atelier Louz",
		menuNote: "By appointment, Sunday to Thursday.",
	},
	hero: {
		tag: "Interior architecture — Algiers",
		titleStart: "Homes that breathe the",
		titleAccent: "South.",
		subtitle:
			"Atelier Louz designs apartments, villas, and workplaces around the best that Algiers gives: morning light, lime, terracotta, and the hands that still know how to work them.",
		// The hero button and the phone menu show the full label. The number matches site.phoneDisplay.
		callLabel: "Call the studio — 021\u00a000\u00a000\u00a000",
		materialsCta: "Explore the material library",
		note: "By appointment, Sunday to Thursday · El Biar, Algiers",
		sceneLabel:
			"Drawn scene: a sunlit arcade with an arched window, the shadow of a palm, a hanging lamp, and a terracotta floor.",
	},
	band: {
		label: "Materials that the studio works with",
		lime: "Lime plaster",
		tadelakt: "Tadelakt",
		zellige: "Zellige",
		walnut: "Walnut",
		brass: "Brass",
		linen: "Linen",
		terracotta: "Terracotta",
		alfa: "Alfa fibre",
	},
	materials: {
		tag: "The material library",
		titleStart: "Choose a material.",
		titleEnd: "The room tries it on in front of you.",
		intro:
			"Six materials, each sourced from craftspeople we know by their first name. Pick a sample: the living room takes its colors, and the whole page tries the material with it.",
		cabinetTag: "The sample cabinet",
		groupLabel: "Choose a material to retint the living room",
		roomLabel:
			"Drawn living room: a wall, a sunlit arched window, a sofa, a rug, and a niche with a vase. The colors follow the chosen material.",
		honestLine: "Every sample exists for real, on the studio table.",
		tadelakt: {
			name: "Tadelakt",
			source: "Tipaza lime",
			note: "Tadelakt — lime polished with a pebble and black soap. Water walls, built-in benches, soft curves.",
		},
		zellige: {
			name: "Zellige",
			source: "hand-glazed, Tlemcen",
			note: "Zellige — glazed by hand, laid tight. Splashbacks, basins, and patios that shine at night.",
		},
		walnut: {
			name: "Walnut",
			source: "solid, matte oil",
			note: "Walnut — solid, with a matte oil. Joinery, worktops, and stairs that age well.",
		},
		alfa: {
			name: "Alfa fibre",
			source: "woven, Ghardaïa",
			note: "Alfa and doum, woven in Ghardaïa. Seats, lamps, and rugs that smell of summer.",
		},
		brass: {
			name: "Brass",
			source: "patinated, Casbah",
			note: "Brass — patinated, never varnished. Handles, taps, and rails that keep the trace of hands.",
		},
		linen: {
			name: "Linen",
			source: "washed, never ironed",
			note: "Linen — washed, never ironed. Curtains that soften the light, benches, summer beds.",
		},
	},
	projects: {
		tag: "Delivered projects",
		title: "Three sites, three kinds of light.",
		intro:
			"Each vignette is drawn from the project. No retouched photo: only the composition, the arches, and the materials as they were laid.",
		area: "Area",
		duration: "Duration",
		materialsLabel: "Materials",
		enfilade: {
			place: "Apartment — Telemly",
			title: "The reopened enfilade",
			body: "A 1930s apartment that runs from street to garden, high above the bay. We reopened the enfilade, arched the doorways, and let the tadelakt catch the morning light, from the kitchen to the study.",
			area: "96 m²",
			duration: "4 months",
			materials: "Tadelakt · Walnut · Brass",
			sceneLabel:
				"Drawn scene: three arches in a row, one inside the other, with morning light at the end and a walnut floor.",
		},
		patio: {
			place: "Villa — Hydra",
			title: "The patio that cools",
			body: "A family villa around a planted patio. Green zellige runs from the basin to the kitchen, terracotta keeps the summer cool, and linen filters the four o’clock light.",
			area: "240 m²",
			duration: "9 months",
			materials: "Zellige · Terracotta · Linen",
			sceneLabel:
				"Drawn scene: a patio with two sunlit arched windows, a palm, a band of green zellige, and a round basin.",
		},
		counter: {
			place: "Workplace — El Biar",
			title: "The arched counter",
			body: "A neighbourhood café, delivered between two services. An arched terracotta counter, benches in woven alfa, and brass that wears well exactly where hands rest.",
			area: "75 m²",
			duration: "6 weeks",
			materials: "Terracotta · Alfa · Brass",
			sceneLabel:
				"Drawn scene: a café with a terracotta counter cut with small arches, three brass lamps, a menu board, and a stool.",
		},
	},
	interlude: {
		tag: "What the studio believes",
		lineStart: "Light first.",
		lineEnd: "The rest follows.",
	},
	method: {
		tag: "The method",
		title: "Four steps, one arch.",
		intro:
			"From the first coffee at your place to the handover of the keys, the path is always the same, and you always know where you stand.",
		visit: {
			title: "The visit",
			body: "We listen to the walls first: a survey, the path of the sun, the real use of each room.",
			chip: "Algiers area · within 10 days",
		},
		sketch: {
			title: "The sketch",
			body: "Plans, arched volumes, a first palette of materials. Two rounds of changes are included.",
			chip: "2 to 3 weeks",
		},
		material: {
			title: "The material",
			body: "Real samples on the table: you touch everything before you decide. Trusted craftspeople only.",
			chip: "1 studio in El Biar",
		},
		site: {
			title: "The work site",
			body: "A visit every week, one single contact, and a handover room by room.",
			chip: "2 to 9 months per project",
		},
		doorTitle: "A doubt halfway through?",
		doorBody: "We pick up. One contact, from the first survey to the keys.",
	},
	contact: {
		tag: "First appointment",
		title: "Let’s talk about your walls.",
		intro:
			"Tell us about the room, and we bring the samples. A consultation visit in Algiers costs 8,000 DA. We deduct it from the quote when the project starts.",
		callStep: "Call",
		// No-break spaces keep the time range on one line.
		callBody: "Sunday to Thursday, 9\u00a0am\u00a0–\u00a06\u00a0pm.",
		writeStep: "Write",
		writeBody: "Send the room, the town, and two photos.",
		visitStep: "Visit",
		visitBody: "El Biar, Algiers. The sample table is open by appointment.",
		mainCta: "Ask for a visit",
		callBack: "We call back within 48 working hours, Sunday to Thursday.",
		welcome: "Children are welcome at the studio.",
	},
	footer: {
		studio: "Studio",
		phone: "Telephone",
		hours: "Hours",
		legal: "Atelier Louz — interior architecture, Algiers",
		scope: "Apartments · Villas · Workplaces",
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
