import { z } from "zod";

const requiredText = z.string().min(1);
const hexColor = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/)
	.describe("An exact six-digit CSS hex color.");
const semanticId = z
	.string()
	.min(1)
	.max(48)
	.regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
	.describe("A unique kebab-case HTML section id, no more than 48 characters.");

/**
 * A bounded list of short free-text directives.
 *
 * Gateway models do not reliably honor `maxItems` while decoding structured
 * output, and one extra advisory bullet must not discard an otherwise complete
 * spec. The maximum is therefore stated as guidance in the schema description
 * and enforced by truncation, which keeps the earlier, higher-priority entries.
 */
function advisoryList(min: number, max: number, description: string) {
	const guidance =
		min > 0 ? `Provide ${min} to ${max} items.` : `Provide at most ${max} items.`;
	const list = z.array(requiredText);

	return (min > 0 ? list.min(min) : list)
		.describe(`${description} ${guidance}`)
		.transform((items) => items.slice(0, max));
}

const paletteSchema = z.object({
	accent: hexColor.describe("Exact color for the sparingly used accent role."),
	accentForeground: hexColor.describe(
		"Exact color with readable contrast when content sits on the accent color.",
	),
	background: hexColor.describe("Exact color for the primary page canvas."),
	border: hexColor.describe(
		"Exact color for rules, dividers, and quiet structure.",
	),
	foreground: hexColor.describe(
		"Exact color for primary text on the main background.",
	),
	muted: hexColor.describe(
		"Exact color for secondary surfaces or subdued areas.",
	),
	mutedForeground: hexColor.describe(
		"Exact color for readable secondary text on the main or muted surface.",
	),
	primary: hexColor.describe(
		"Exact color for the main action and strongest brand emphasis.",
	),
	primaryForeground: hexColor.describe(
		"Exact color for readable content placed on the primary color.",
	),
	secondary: hexColor.describe(
		"Exact color for the supporting surface or secondary emphasis.",
	),
	secondaryForeground: hexColor.describe(
		"Exact color with readable contrast when content sits on the secondary color.",
	),
});

const fontRoleSchema = z
	.object({
		fallback: requiredText.describe("A safe CSS fallback font stack."),
		family: requiredText.describe(
			"The exact typeface family to use. It must be publicly loadable or a system font.",
		),
		source: z.enum(["google-fonts", "system"]),
		stylesheetUrl: z
			.url()
			.nullable()
			.describe(
				"The exact public Google Fonts CSS URL, or null for a system font.",
			),
		treatment: requiredText.describe(
			"How this role is set: weight, width, casing, tracking, line height, and characteristic usage.",
		),
	})
	.superRefine((font, context) => {
		if (font.source === "google-fonts" && font.stylesheetUrl === null) {
			context.addIssue({
				code: "custom",
				message: "Google Fonts roles require an exact stylesheetUrl",
				path: ["stylesheetUrl"],
			});
		}

		if (font.source === "system" && font.stylesheetUrl !== null) {
			context.addIssue({
				code: "custom",
				message: "System font roles must use a null stylesheetUrl",
				path: ["stylesheetUrl"],
			});
		}
	});

const sectionSchema = z.object({
	entryTransition: requiredText.describe(
		"How this scene enters from the previous one: continuation, overlap, bleed, crop, inversion, bridge element, or deliberate hard cut.",
	),
	composition: requiredText.describe(
		"Concrete placement, proportions, hierarchy, whitespace, layering, and focal tension.",
	),
	contentPlan: requiredText.describe(
		"Which supplied facts or messages belong here and the order in which the visitor understands them.",
	),
	job: requiredText.describe(
		"The one communication or conversion job this scene performs.",
	),
	media: requiredText
		.nullable()
		.describe(
			"A scene-specific media role, or null when the global media direction is enough.",
		),
	mobile: requiredText
		.nullable()
		.describe(
			"A special mobile recomposition for this scene, or null when the global responsive direction is enough.",
		),
	motion: requiredText
		.nullable()
		.describe(
			"A purposeful scene-specific reveal or scroll behavior, or null when the global motion direction is enough.",
		),
	name: requiredText,
	semanticId,
	topology: requiredText.describe(
		"The spatial regime of this scene. Repetition is allowed only when it is a deliberate part of the concept.",
	),
	userInteraction: requiredText
		.nullable()
		.describe(
			"A useful scene-specific interaction that reveals, compares, navigates, simulates, or transforms information; null when stillness is stronger.",
		),
});

const generatedShotSchema = z.object({
	aspect: z.enum(["1:1", "2:3", "3:2", "4:5", "16:9"]),
	id: semanticId.describe(
		"A unique short id the Builder must pass to generate exactly this planned shot.",
	),
	placement: requiredText.describe(
		"Where and how the image is composed into the page.",
	),
	prompt: requiredText.describe(
		"A self-contained production prompt: medium, subject, setting, light, mood, composition, palette anchors, and 'no text, logos, watermarks, or UI'. Do not depend on identity continuity with another generated shot.",
	),
	role: requiredText.describe(
		"The design job of the image, not merely its subject.",
	),
});

/**
 * The typed handoff between the Art Director and the Builder.
 *
 * It intentionally describes relationships and page-level composition, not a
 * menu of fashionable effects. The fixed shape prevents important design
 * decisions from disappearing inside a free-text brief while all values stay
 * free for the Art Director to invent per project.
 */
export const creativeSpecSchema = z.object({
	builderContract: z.object({
		failureModes: advisoryList(
			2,
			8,
			"Project-specific ways an implementation could look correct but betray this direction.",
		),
		freedom: advisoryList(
			1,
			6,
			"Small implementation decisions the Builder may make without changing the direction.",
		),
		nonNegotiables: advisoryList(
			3,
			10,
			"Observable design commitments the Builder must preserve exactly.",
		),
		priorityOrder: advisoryList(
			3,
			6,
			"Ranked priorities the Builder should protect when tradeoffs are necessary.",
		),
	}),
	brandWorld: z.object({
		signatureMotif: requiredText.describe(
			"One project-specific visual behavior or artifact the page can be remembered by.",
		),
		sourceMaterial: advisoryList(
			1,
			8,
			"Real materials, tools, rituals, objects, language, measurements, or operational details from this business that can shape the design.",
		),
		verbalTone: requiredText.describe(
			"The concrete writing voice for headlines, labels, buttons, and supporting copy.",
		),
	}),
	conversion: z.object({
		formBehavior: requiredText.describe(
			"Required fields, validation, success behavior, or 'no form' when the primary action uses another channel.",
		),
		primaryAction: requiredText.describe(
			"The single main visitor action, using only details present in the content brief.",
		),
		secondaryActions: advisoryList(
			0,
			3,
			"Zero to three supporting actions that serve the journey without competing with the primary action.",
		),
		placementStrategy: requiredText.describe(
			"How the primary action is integrated into the composition across the page without becoming repetitive.",
		),
		trustStrategy: requiredText.describe(
			"How supplied proof and trust facts are presented without inventing reviews, metrics, or claims.",
		),
	}),
	direction: z.object({
		antiGoals: advisoryList(
			3,
			8,
			"Specific visual outcomes this project must avoid.",
		),
		businessConnection: requiredText.describe(
			"Why this idea could belong to this business and would be wrong for an unrelated business.",
		),
		concept: requiredText.describe(
			"One clear concept operator that governs space, type, color, media, motion, and language.",
		),
		distinctiveDecision: requiredText.describe(
			"The controlled choice that makes the result memorable. It may be expressive, unusually useful, or exceptionally restrained.",
		),
		emotionalTarget: requiredText.describe(
			"What the intended customer should feel while moving through the page.",
		),
		name: requiredText.describe(
			"A short original name for this project-specific direction, not a generic style category.",
		),
		principles: advisoryList(
			3,
			5,
			"Rules that translate the concept into repeatable design decisions.",
		),
	}),
	opening: z.object({
		assetIndependentFallback: requiredText.describe(
			"How the opening remains visually memorable if its main photograph or generated image is unavailable.",
		),
		composition: requiredText.describe(
			"Precise viewport composition: anchors, proportions, layers, whitespace, reading order, and CTA integration.",
		),
		concept: requiredText.describe(
			"The opening scene and how it proves the overall concept immediately.",
		),
		contentPlacement: requiredText.describe(
			"Where headline, supporting copy, navigation, metadata, and primary action live.",
		),
		dominantElement: requiredText.describe(
			"The main carrier of attention: typography, object, live diagram, image sequence, interface, illustration, or another fitting medium.",
		),
		entranceMotion: requiredText.describe(
			"The opening choreography and timing, or a reasoned decision to open without motion.",
		),
		// This decision is also expressed by concept, composition, silhouette,
		// and dominantElement. Some Gateway models occasionally omit only this
		// summary field from an otherwise complete structured response, so a
		// safe builder instruction is preferable to discarding the full spec.
		format: requiredText
			.default(
				"Follow the opening architecture already defined by concept, composition, silhouette, and dominantElement; do not substitute a standard hero.",
			)
			.describe(
				"The chosen opening architecture, such as a hero, integrated first scene, persistent canvas, narrative sequence, utility-first view, or another project-specific form.",
			),
		mediaRole: requiredText.describe(
			"Whether media is evidence, atmosphere, object, narrative, diagram, or responsive surface.",
		),
		mobileRecomposition: requiredText.describe(
			"A concrete mobile composition that preserves the concept and conversion action.",
		),
		semanticId: z
			.literal("hero")
			.describe("The fixed semantic HTML id for the opening scene."),
		silhouette: requiredText.describe(
			"The recognizable black-and-white shape of the opening before color, imagery, or polish.",
		),
	}),
	media: z.object({
		ambientVideo: z
			.object({
				aspect: z.enum(["1:1", "9:16", "16:9"]),
				motionPrompt: requiredText.describe(
					"The exact restrained motion instruction the Builder may use.",
				),
				placement: requiredText.describe(
					"Where the ambient loop belongs and why a still image is not enough.",
				),
				source: z.discriminatedUnion("kind", [
					z.object({
						kind: z.literal("generated-shot"),
						reference: semanticId.describe(
							"The exact generated shot id to animate.",
						),
					}),
					z.object({
						kind: z.literal("user-asset"),
						reference: z
							.url()
							.describe(
								"The exact supplied Wandit-hosted asset URL to animate.",
							),
					}),
				]),
			})
			.nullable()
			.describe(
				"One optional ambient video plan. Use null unless motion materially supports the concept.",
			),
		assetFallback: requiredText.describe(
			"CSS, SVG, type, or layout fallback when generated media is unavailable.",
		),
		generatedShots: z
			.array(generatedShotSchema)
			.max(6)
			.describe(
				"Only shots that materially support the concept. An empty list is valid and often stronger.",
			),
		role: requiredText.describe(
			"The page-wide job of media and the rules for crops, scale, framing, captions, and repetition.",
		),
		userAssetTreatment: requiredText.describe(
			"How supplied brand or product assets should be framed and integrated without changing their factual content.",
		),
	}),
	motion: z.object({
		interactionLanguage: requiredText.describe(
			"One coherent family of hover, pointer, tap, or state-change behavior.",
		),
		philosophy: requiredText.describe(
			"Why and where the page moves, including which areas should stay still.",
		),
		primarySpatialBehavior: requiredText.describe(
			"The main page-level motion behavior, if any, and what meaning it communicates.",
		),
		reducedMotion: requiredText.describe(
			"Accessible alternatives that keep all content and actions available.",
		),
		revealLanguage: requiredText.describe(
			"One coherent entrance/reveal vocabulary rather than unrelated effects per section.",
		),
		timingAndEasing: requiredText.describe(
			"Concrete duration, stagger, easing, and scroll-trigger guidance.",
		),
	}),
	page: z.object({
		closure: z.object({
			composition: requiredText.describe(
				"How the page resolves its concept, conversion action, practical information, and footer without falling back to a generic CTA rectangle.",
			),
			contentPlan: requiredText.describe(
				"Which supplied final facts, links, legal details, and actions belong in the closing experience.",
			),
			entryTransition: requiredText.describe(
				"How the closing experience enters from the final content scene.",
			),
			mobile: requiredText.describe(
				"How the closing composition and navigation work at a narrow viewport.",
			),
			semanticId: z
				.literal("site-footer")
				.describe("The fixed semantic HTML id for the closing/footer scene."),
		}),
		navigation: z.object({
			behavior: requiredText.describe(
				"Placement, persistence, hierarchy, and how navigation belongs to the overall concept.",
			),
			desktop: requiredText.describe(
				"The desktop navigation composition, destinations, and interaction.",
			),
			mobile: requiredText.describe(
				"The mobile navigation pattern, touch behavior, and conversion access.",
			),
		}),
		sections: z
			.array(sectionSchema)
			.min(1)
			.max(10)
			.describe(
				"Ordered scenes after the opening. Their topology and entry transitions must create one continuous experience.",
			),
		showpiece: z.object({
			ambition: requiredText.describe(
				"What receives extra compositional, interactive, or narrative craft and why.",
			),
			semanticId: semanticId.describe(
				'The semanticId of the visual peak. It may be "hero" or one section semanticId.',
			),
		}),
		spine: requiredText.describe(
			"The page-level organizing idea that connects all scenes beyond a normal stack of sections.",
		),
		tempo: requiredText.describe(
			"The density and energy curve from opening to conversion, such as immersive → quiet → exploratory → decisive.",
		),
	}),
	responsive: z.object({
		desktop: requiredText.describe(
			"The intended large-screen canvas behavior and maximum useful width.",
		),
		mobile: requiredText.describe(
			"The global mobile strategy: order, density, navigation, touch behavior, and which effects simplify.",
		),
		tablet: requiredText.describe(
			"How the design handles the difficult middle width without overflow or collapsed hierarchy.",
		),
	}),
	visualSystem: z.object({
		compositionRules: requiredText.describe(
			"The page-wide alignment, grid, scale, whitespace, and controlled-breaking rules.",
		),
		density: requiredText.describe(
			"The intended information and visual density, including where it changes for rhythm.",
		),
		invariants: advisoryList(
			3,
			7,
			"What stays consistent while section geometry changes: line language, palette roles, type behavior, motion physics, or another concept carrier.",
		),
		palette: paletteSchema,
		radius: requiredText.describe(
			"The CSS radius token and where squared or differently shaped exceptions are meaningful.",
		),
		shapeLanguage: requiredText.describe(
			"The geometry, line, crop, edge, and container language derived from the concept.",
		),
		surfaceTreatment: requiredText.describe(
			"Material, texture, borders, shadows, depth, and background treatment. Decoration must support the concept.",
		),
		typography: z.object({
			body: fontRoleSchema,
			heading: fontRoleSchema,
			utility: fontRoleSchema,
		}),
	}),
	schemaVersion: z.literal("creative-spec/v1"),
});

export type CreativeSpec = z.infer<typeof creativeSpecSchema>;

export function serializeCreativeSpec(spec: CreativeSpec): string {
	return JSON.stringify(spec, null, 2);
}

/**
 * JSON Schema validation guarantees shape; these cross-field rules guarantee
 * that the Builder can actually address the Art Director's scenes.
 */
export function assertCreativeSpecSemantics(spec: CreativeSpec): void {
	const sectionIds = spec.page.sections.map((section) => section.semanticId);
	const uniqueIds = new Set(sectionIds);

	if (uniqueIds.size !== sectionIds.length) {
		throw new Error("CreativeSpec contains duplicate section semanticIds");
	}

	if (uniqueIds.has(spec.opening.semanticId)) {
		throw new Error(
			`CreativeSpec section semanticId "${spec.opening.semanticId}" conflicts with the opening`,
		);
	}

	if (uniqueIds.has(spec.page.closure.semanticId)) {
		throw new Error(
			`CreativeSpec section semanticId "${spec.page.closure.semanticId}" conflicts with the closing scene`,
		);
	}

	const reservedElementId = sectionIds.find((id) => /^e-\d+$/.test(id));

	if (reservedElementId) {
		throw new Error(
			`CreativeSpec section semanticId "${reservedElementId}" is reserved for editable elements`,
		);
	}

	const shotIds = spec.media.generatedShots.map((shot) => shot.id);

	if (new Set(shotIds).size !== shotIds.length) {
		throw new Error("CreativeSpec contains duplicate generated shot ids");
	}

	if (
		spec.media.ambientVideo?.source.kind === "generated-shot" &&
		!shotIds.includes(spec.media.ambientVideo.source.reference)
	) {
		throw new Error(
			`CreativeSpec ambient video source "${spec.media.ambientVideo.source.reference}" does not match a generated shot id`,
		);
	}

	const validShowpieceIds = new Set([spec.opening.semanticId, ...sectionIds]);

	if (!validShowpieceIds.has(spec.page.showpiece.semanticId)) {
		throw new Error(
			`CreativeSpec showpiece "${spec.page.showpiece.semanticId}" does not match the opening or a section semanticId`,
		);
	}
}
