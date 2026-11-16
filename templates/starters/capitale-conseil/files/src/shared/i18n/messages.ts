// Every user-facing string of the app, in the default language (`locales[0]`).
// Components read it through `t("group.key")` from useT(); translate.ts loads it.
// The groups from `site` to `footer` are the texts of the home page, one group for each section.
// A second language gets its own file with the same keys (CLAUDE.md "Languages").
/** The default-language dictionary. `shell` and `table` hold the strings of the app shell and DataTable. */
export const messages = {
	common: {
		appName: "Capitale Conseil",
		save: "Save",
		retry: "Try again",
		signOut: "Sign out",
		language: "Language",
	},
	site: {
		brandFirst: "Capitale",
		brandSecond: "Conseil",
		metaTitle:
			"Capitale Conseil — Strategy consulting & asset management, Algiers",
		metaDescription:
			"Capitale Conseil is an independent advisory firm in Algiers: strategy, capital transactions, asset management, and governance. DZD 4.2 bn under advisory.",
		skipToContent: "Skip to content",
		navLabel: "Sections of the site",
		navFirm: "The firm",
		navPractices: "Practices",
		navFigures: "Figures",
		navReferences: "References",
		navContact: "Contact",
		spineLabel: "Index of the movements",
		counterLabel: "Current movement",
		menuOpen: "Open the menu",
		menuDescription: "The five movements of the page and the telephone.",
		phoneDisplay: "+213 21 00 00 00",
		phoneHref: "tel:+21321000000",
		email: "contact@capitale-conseil.example",
	},
	hero: {
		label: "Strategy consulting & asset management — Algiers",
		title: "We advise on the decisions that bind you for ten years.",
		lead: "Capitale Conseil works with family-owned groups, financial institutions, and Algerian funds on their defining transactions: sales, minority capital raises, asset allocation, governance.",
		ctaMeeting: "Request a meeting",
		ctaMandate: "See a case study",
		fig1Value: "4",
		fig1Unit: "partners",
		fig1Label: "Lead each mandate",
		fig2Value: "3",
		fig2Unit: "cities",
		fig2Label: "Where we work",
		fig3Value: "0",
		fig3Unit: "commissions",
		fig3Label: "Fixed fees only",
		plateAlt:
			"Lobby of a head office at dusk, with distant silhouettes in front of a glass facade",
		plateLine: "Algiers — Head office, 2025",
		plateNote:
			"The lobby of the head office, on the evening of an investment committee.",
	},
	firm: {
		label: "01 — The firm",
		yearValue: "2009",
		yearLabel: "Year of foundation",
		yearPlace: "Algiers",
		title: "An independent firm, owned by its partners.",
		paragraph1:
			"Capitale Conseil was founded in Algiers in 2009 by Réda Kessal, a former head of lending at a public bank, on one simple rule: never sell the client anything but an opinion.",
		paragraph2:
			"We distribute no financial product, we take no commissions, and we never act on both sides of one transaction. When a mandate is outside our competence, we say so on the first day.",
		paragraph3:
			"A partner leads each mandate with a team of three or four consultants, never more. The partner who signs the proposal is the one who presents the conclusions to the board, eighteen months later if necessary.",
		paragraph4:
			"We work in French and in Arabic, in Algiers, Oran, and Constantine, for firms that are handed down more often than they are sold.",
		independenceTitle: "Independence",
		independenceBody:
			"No product distributed, no commission taken, no dual mandate.",
		confidentialityTitle: "Confidentiality",
		confidentialityBody:
			"The name of a client appears nowhere without written consent.",
		feesTitle: "Fees",
		feesBody:
			"A fixed fee, stated before the first day of work and revised only by written amendment.",
	},
	practices: {
		label: "02 — Practices",
		title: "Four practices, one table.",
		strategy: {
			title: "Strategy consulting",
			body: "Five-year plan, entry into a new market, portfolio trade-offs, and costed scenarios before the board meeting.",
			count: "12 mandates",
			sectors: "Industry · Retail · Energy",
			tag1: "Algiers",
			tag2: "Oran",
		},
		capital: {
			title: "Capital transactions",
			body: "Sale, acquisition, minority capital raise, independent valuation, and running the process through to closing.",
			count: "14 mandates",
			sectors: "Corporate finance",
			tag1: "9 sales",
		},
		assets: {
			title: "Asset management",
			body: "Allocation, discretionary mandates, quarterly reporting on a fixed date, and an annual review before the investment committee.",
			count: "7 mandates",
			sectors: "Institutions · Families",
			tag1: "DZD 4.2 bn",
		},
		governance: {
			title: "Governance & succession",
			body: "Board composition, shareholder agreements, preparation of the next generation, and mediation between heirs.",
			count: "4 mandates",
			sectors: "Board & committees",
			tag1: "Long term",
		},
	},
	figures: {
		label: "03 — Figures",
		title: "What seventeen years of mandates have produced.",
		scope:
			"Figures as of 31 December 2025, scope Capitale Conseil SPA. Assets are stated in current dinars.",
		assets: {
			spoken: "4.2 billion dinars",
			unit: "bn DZD",
			note: "Assets monitored for eleven institutions and six family groups, reviewed each quarter.",
			label: "Assets under advisory",
			source: "As of 31.12.2025",
		},
		mandates: {
			spoken: "37 mandates",
			unit: "mandates",
			note: "Including nine sales and four minority capital raises, each run through to closing.",
			label: "Closed since 2009",
			source: "17 financial years",
		},
		renewal: {
			spoken: "94%",
			// The sign follows the digits at full size. A French text writes it with a space before it.
			suffix: "%",
			note: "Share of clients who give us a second mandate within three years.",
			label: "Renewal rate",
			source: "Cohort 2009 – 2025",
		},
	},
	references: {
		label: "04 — References",
		title: "Agri-food group, Blida\u00a0— minority capital raise.",
		plateAlt:
			"Boardroom on the top floor of a tower, with a view of the city at dusk",
		plateLine: "Algiers — Boardroom, 2024",
		plateNote: "Presentation of the conclusions, eleventh week of the mandate.",
		contextTitle: "Context",
		contextBody:
			"A family group of 620 employees and three plants. Cash had financed its growth until then, and two heirs disagreed on the pace.",
		engagementTitle: "Engagement",
		engagementBody:
			"Eleven weeks: analytical review, independent valuation, structuring of a minority stake, and preparation of the board and of the two committees.",
		outcomeTitle: "Outcome",
		outcomeBody:
			"A regional fund took 24% of the capital. The shareholder agreement was signed, and two independent directors joined the board.",
		resultValue: "1.8",
		resultUnit: "bn DZD",
		resultLabel: "Raised in 2024",
		durationLabel: "Duration",
		durationValue: "11 weeks",
		teamLabel: "Team",
		teamValue: "1 partner, 3 consultants",
		feesLabel: "Fees",
		feesValue: "Fixed, stated on day 1",
	},
	quote: {
		label: "From a client",
		text: "“They said no to two buyers before they showed us the right one. It is the first time that an adviser made us lose time for the right reason.”",
		attribution: "Farid Belkacem — Managing Director, agri-food group (Blida)",
		mandateLabel: "Mandate",
		mandateValue: "Minority capital raise",
		durationLabel: "Duration",
		durationValue: "11 weeks, 2024",
		followUpLabel: "Follow-up",
		followUpValue: "Board advice, quarterly",
	},
	partners: {
		label: "Governance",
		title: "Four partners. No mandate without one of them.",
		kessal: {
			initials: "RK",
			name: "Réda Kessal",
			role: "Founding partner",
			field: "Strategy, capital transactions, institutional relations.",
			since: "Partner since 2009",
		},
		meziane: {
			initials: "LM",
			name: "Lynda Meziane",
			role: "Partner",
			field: "Asset management, allocation, investment committees.",
			since: "Partner since 2012",
		},
		belhadj: {
			initials: "SB",
			name: "Sofiane Belhadj",
			role: "Partner",
			field: "Valuation, due diligence, financial modelling.",
			since: "Partner since 2015",
		},
		aitOuarab: {
			initials: "NA",
			name: "Nadia Ait Ouarab",
			role: "Partner",
			field: "Governance, shareholder agreements, family succession.",
			since: "Partner since 2018",
		},
	},
	office: {
		label: "Head office",
		text: "The committees sit in Tower\u00a0B, in front of the bay window. A mandate opens there, is debated there, and closes there — never elsewhere.",
		plateAlt: "Glass facade of an office tower at dusk, seen from below",
		plateLine: "Algiers — Tower\u00a0B, Parc des Cèdres, 2025",
		plateNote:
			"The east facade, a quarter of an hour before the December committee.",
		plateSide: "Head office since 2009",
	},
	contact: {
		label: "05 — Contact",
		title: "The first meeting lasts one hour and costs nothing.",
		addressLabel: "Address",
		addressLine1: "Tower\u00a0B, Parc des Cèdres",
		addressLine2: "16000 Algiers",
		phoneLabel: "Telephone",
		emailLabel: "Email",
		hoursLabel: "Hours",
		hoursValue: "Sunday to Thursday, 8:30 am – 5:30 pm",
		feesLabel: "Fees",
		feesValue: "A fixed fee, sent in writing after the first meeting.",
		accessLabel: "Access",
		accessText:
			"Tramway to the Parc des Cèdres stop, then 300\u00a0m on foot. Visitor parking is on level\u00a0−1: give your name at reception.",
		accessFigure: "17",
		accessFigureText: "years on the same floor of Tower\u00a0B.",
		briefIntro:
			"Describe the transaction in two lines. A partner — not an assistant — calls you back within 48 working hours.",
		topicLabel: "Subject of the mandate",
		topics: {
			sale: "Sale or acquisition",
			capital: "Minority capital raise",
			allocation: "Asset allocation",
			governance: "Governance & succession",
			other: "Another subject",
		},
		draftTitle: "Your request",
		draftToLabel: "To",
		draftSubjectLabel: "Subject",
		// The picked subject follows this prefix directly, so the prefix holds its own separator.
		draftSubjectPrefix: "First meeting — ",
		writeAction: "Write to a partner",
		privacyNote:
			"Your information stays with us. No file is sold, and no newsletter is sent.",
	},
	footer: {
		legalLine1:
			"SPA with share capital of DZD\u00a024,000,000 · Tower\u00a0B, Parc des Cèdres, Algiers",
		legalLine2:
			"©\u00a02026 Capitale Conseil SPA · Strategy consulting & asset management",
		navLabel: "Footer",
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
