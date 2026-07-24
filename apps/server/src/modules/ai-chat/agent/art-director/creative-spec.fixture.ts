import type { CreativeSpec } from "./creative-spec";

export function createCreativeSpecFixture(): CreativeSpec {
	return {
		brandWorld: {
			signatureMotif: "A measured arc that opens as confidence grows.",
			sourceMaterial: ["dental arch measurements", "calm consultation ritual"],
			verbalTone: "Clear, calm, concrete, and reassuring.",
		},
		builderContract: {
			failureModes: [
				"Ordinary copy-left image-right clinic hero",
				"Equal service cards",
				"Decorative medical icons with no information role",
			],
			freedom: [
				"Exact SVG path construction",
				"Minor spacing adjustments required by real copy",
			],
			nonNegotiables: [
				"The measurement arc connects every scene",
				"The hero remains recognizable without photography",
				"Services are navigated as a diagnostic index",
				"Motion stays controlled and calm",
			],
			priorityOrder: [
				"Business-specific concept",
				"Hero silhouette",
				"Readable conversion path",
			],
		},
		conversion: {
			formBehavior: "No form; the booking link uses the supplied contact.",
			placementStrategy:
				"Booking begins as a small calibrated marker and resolves as the final action.",
			primaryAction: "Book an appointment using the supplied contact channel.",
			secondaryActions: [
				"View practical visit information without competing with booking.",
			],
			trustStrategy:
				"Use only practitioner and process facts from the Content Brief.",
		},
		direction: {
			antiGoals: [
				"Generic luxury clinic",
				"Split-screen photograph",
				"Rows of service cards",
			],
			businessConnection:
				"Measurement, explanation, and controlled pacing reflect the clinic's precise and reassuring care.",
			concept:
				"Precision removes anxiety: a calm diagnostic line gradually becomes a path to care.",
			distinctiveDecision:
				"The headline follows an architectural arc instead of a rectangular text column.",
			emotionalTarget:
				"Concern becomes informed calm and then confident action.",
			name: "Quiet Calibration",
			principles: [
				"Measure before decorating",
				"Reveal information in the order a patient needs it",
				"Use calm contrast instead of clinical emptiness",
			],
		},
		opening: {
			assetIndependentFallback:
				"The measurement arc, asymmetric type geometry, and treatment index remain the focal composition.",
			composition:
				"Headline wraps around a large arc anchored low right; navigation and booking sit on its measured ticks.",
			concept: "A consultation begins before the visitor scrolls.",
			contentPlacement:
				"Brand top left, navigation on the upper rail, headline around the arc, action at the final tick.",
			dominantElement: "An interactive dental-arch measurement diagram.",
			entranceMotion:
				"The arc draws in 900ms, then labels and type resolve in measured 90ms steps.",
			format:
				"An integrated first scene: navigation, diagnosis story, and conversion share one measured canvas.",
			mediaRole:
				"Photography is supporting evidence inside one calibrated crop, never the background.",
			mobileRecomposition:
				"The arc becomes a vertical half-curve with headline above and booking fixed after the last tick.",
			semanticId: "hero",
			silhouette:
				"Large empty upper-left field crossed by one low asymmetric arc and a compact type mass.",
		},
		media: {
			ambientVideo: null,
			assetFallback:
				"Use inline SVG measurement drawings and controlled typographic crops.",
			generatedShots: [],
			role: "Evidence appears sparingly inside the measurement system.",
			userAssetTreatment:
				"Use supplied clinic photography as quiet documentary evidence with consistent neutral crops.",
		},
		motion: {
			interactionLanguage:
				"Pointer or tap advances a measured marker and reveals related facts.",
			philosophy:
				"Movement explains sequence and precision; reading areas remain still.",
			primarySpatialBehavior:
				"The measurement line changes orientation while continuing between scenes.",
			reducedMotion:
				"Render the completed line and reveal every label immediately.",
			revealLanguage:
				"Line first, then label, then supporting copy; no unrelated fade-up effects.",
			timingAndEasing:
				"500–900ms transformations with cubic-bezier(0.16, 1, 0.3, 1).",
		},
		page: {
			closure: {
				composition:
					"The measurement line resolves into a quiet practical footer with the real booking action as its final tick.",
				contentPlan:
					"Use only supplied booking, address, schedule, and legal details.",
				entryTransition:
					"The final journey rail curves down and resolves into the practical footer grid.",
				mobile:
					"Stack practical details above one full-width booking action and keep every link touchable.",
				semanticId: "site-footer",
			},
			navigation: {
				behavior:
					"Navigation rides the measurement rail, becomes a compact calibrated strip after the opening, and never floats as a generic pill.",
				desktop:
					"Place the brand at the rail origin, section destinations on ticks, and booking at the final emphasized tick.",
				mobile:
					"Use a compact disclosure with visible booking access and large touch targets.",
			},
			sections: [
				{
					entryTransition:
						"The hero arc extends into the section as a vertical rule.",
					composition:
						"A tall treatment index occupies the left edge while details unfold in a wide right field.",
					contentPlan:
						"Present only the supplied treatments and their purpose.",
					job: "Help visitors understand the available care.",
					media:
						"Small documentary details appear only for the active treatment.",
					mobile:
						"Treatments become a horizontal snap index above one changing detail panel.",
					motion:
						"The active marker moves; content crossfades without page drift.",
					name: "Treatment index",
					semanticId: "treatments",
					topology: "Vertical index with one expansive changing field.",
					userInteraction:
						"Selecting a treatment updates the explanation and image.",
				},
				{
					entryTransition:
						"The treatment marker becomes the first step on a horizontal rail.",
					composition:
						"A horizontal journey crosses the viewport with uneven narrative stops.",
					contentPlan:
						"Explain the supplied appointment process in practical order.",
					job: "Remove uncertainty about the visit.",
					media:
						"No required photography; use type, line, and real process labels.",
					mobile:
						"The journey becomes a vertical route with large readable stops.",
					motion: "The route draws only as each real step enters view.",
					name: "Patient journey",
					semanticId: "patient-journey",
					topology: "Full-bleed horizontal route with staggered stops.",
					userInteraction: "Tap a stop to expand its practical detail.",
				},
				{
					entryTransition:
						"The journey rail becomes a circular frame around the action.",
					composition:
						"A compact booking action sits inside a large quiet circular field.",
					contentPlan:
						"Repeat the supplied contact, location, and booking expectation.",
					job: "Turn confidence into an appointment.",
					media: "No image; conversion is the visual object.",
					mobile: "The circle becomes an edge-to-edge lower sheet.",
					motion: "One marker settles on the available action.",
					name: "Booking resolution",
					semanticId: "booking",
					topology: "Quiet circular conversion field.",
					userInteraction:
						"The real booking link is the single primary action.",
				},
			],
			showpiece: {
				ambition:
					"The patient journey is the most spatial and interactive explanation.",
				semanticId: "patient-journey",
			},
			spine:
				"One measurement line travels from diagnosis through treatment understanding to booking.",
			tempo:
				"Measured opening → exploratory index → expansive journey → quiet action.",
		},
		responsive: {
			desktop: "Use the full viewport as a 14-column asymmetrical canvas.",
			mobile:
				"Turn the continuous line vertical, simplify pointer behavior to taps, and keep booking reachable.",
			tablet:
				"Preserve the arc and route while reducing annotation density and avoiding fixed widths.",
		},
		schemaVersion: "creative-spec/v1",
		visualSystem: {
			compositionRules:
				"Align facts to measured ticks; allow one large quiet field per scene.",
			density:
				"Airy hero, medium treatment index, dense journey labels, quiet conversion.",
			invariants: [
				"One-pixel measurement line",
				"Asymmetric type alignment",
				"Controlled 90ms reveal rhythm",
			],
			palette: {
				accent: "#E35B43",
				accentForeground: "#18202A",
				background: "#F4F2ED",
				border: "#B8B4AA",
				foreground: "#18202A",
				muted: "#D9D5CC",
				mutedForeground: "#4D565F",
				primary: "#B63D2D",
				primaryForeground: "#FFFFFF",
				secondary: "#C8D7D3",
				secondaryForeground: "#18202A",
			},
			radius: "2px",
			shapeLanguage:
				"Measured arcs, narrow rules, squared labels, and rare circular frames.",
			surfaceTreatment:
				"Matte paper-like canvas with precise rules and no floating card shadows.",
			typography: {
				body: {
					fallback: "Arial, sans-serif",
					family: "Manrope",
					source: "google-fonts",
					stylesheetUrl:
						"https://fonts.googleapis.com/css2?family=Manrope:wght@400;500&display=swap",
					treatment: "400–500, sentence case, 1.6 line height, 62ch measure.",
				},
				heading: {
					fallback: "Georgia, serif",
					family: "Newsreader",
					source: "google-fonts",
					stylesheetUrl:
						"https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap",
					treatment:
						"Variable optical size, restrained weight, shaped line breaks around the arc.",
				},
				utility: {
					fallback: "monospace",
					family: "IBM Plex Mono",
					source: "google-fonts",
					stylesheetUrl:
						"https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&display=swap",
					treatment: "500, compact labels, tabular numbers, normal casing.",
				},
			},
		},
	};
}
