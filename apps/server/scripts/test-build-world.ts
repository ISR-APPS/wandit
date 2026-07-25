/**
 * Isolation test build — runs the site builder directly (no Trigger, no chat)
 * with a hand-written brain-style brief in the Monographe design world, so
 * before/after quality can be judged on the same dental-clinic brief that
 * produced the disliked baseline. Artifacts land in design/baselines/.
 * Experiment tooling: delete once the worlds pipeline is validated.
 *
 * Run from apps/server: npx tsx scripts/test-build-world.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "@wandit/env/server";

import { buildSiteBuilderSystemPrompt } from "../src/modules/ai-chat/agent/site-builder/builder-prompt";
import { runSiteBuild } from "../src/modules/ai-chat/agent/site-builder/site-builder-agent";
import { monographe } from "../src/modules/ai-chat/agent/worlds/monographe";

const BRIEF = `WORLD: monographe — "Monographe". Un cabinet dentaire haut de gamme qui vend la confiance et le calme: la retenue du monographe d'architecture dit "précision clinique" mieux qu'aucun sourire stocké.

BUSINESS: Cabinet Dentaire Benali — cabinet de dentisterie moderne à Hydra, Alger, dirigé par Dr. Lina Benali, chirurgien-dentiste. Ce qui le distingue: diagnostic expliqué avant chaque acte, gestes doux, matériel récent, rendez-vous à l'heure.

AUDIENCE: patients adultes d'Alger (cadres, familles) qui redoutent le dentiste et choisissent au feeling — ce qui les convainc: calme, clarté des prix, sérieux visible.

PAGE TYPE: site vitrine de cabinet médical, une page. Succès = un rendez-vous pris (formulaire ou WhatsApp).

PAGE GOAL: réservation de rendez-vous — formulaire (nom, téléphone, date souhaitée) + bouton WhatsApp. Téléphone d'abord: saisie type=tel.

OFFER: soins dentaires — Consultation & diagnostic 3 000 DZD · Détartrage 6 000 DZD · Blanchiment 25 000 DZD · Couronne céramique 45 000 DZD · Implantologie sur devis.

LANGUAGE: français.

ART DIRECTION: palette instanciée dans la physique du monde — ground (trio tonal): #121517 / #171B1E / #1D2226 (encre ardoise chaude, pas à pas de 2-5 points RGB) · ink/papier: #EDE9E0 (ivoire chaud, décliné en alpha 1/.8/.6/.42) · accent UNIQUE: #C08A4F (laiton doux) · erreur uniquement: #C97B5A. Fonts: Fraunces (display, axes variables, opsz) + Instrument Sans (texte/UI). Mood: calme, précis, feutré.

PAGE STORY: le site se lit comme la monographie du cabinet — plaques numérotées 01→04, filet laiton et coordonnées géographiques comme motif voyageur.
- Scène 01 — ouverture COVER PLATE: photographie plein cadre du cabinet (lumière douce), titre ancré au sol "Des soins précis, dans le calme." (un seul mot italique laiton: calme), barre masthead sous filet — sous-ligne éditoriale à gauche, dateline factuelle à droite ("Hydra, Alger — 36°44′ N · 3°02′ E — depuis MMXV"). AUCUN bouton dans le héros; l'action vit dans la pilule nav "Rendez-vous". SEAM: scrim-dissolve — la photo se dissout dans l'encre de la page.
- Scène 02 — intro en note de marge (quiet): colonne étroite = filet laiton 44px + micro-label "La pratique"; colonne large = lede serif graisse 300 sur la philosophie du cabinet, puis rang de stats sous filet (années d'exercice, patients suivis, taux de ponctualité). SEAM: tone step.
- Scène 03 — SHOWPIECE (loud): "Le parcours de soin" — galerie horizontale épinglée, 3 panneaux-plaques (01 Diagnostic expliqué · 02 Traitement en douceur · 03 Suivi), numéraux géants au trait derrière la copie, images plates 4/5 avec légendes Fig. 01-03, HUD de progression 01/03 + filet laiton en scaleX. C'est la scène qu'un visiteur capture. SEAM: axis change (l'épingle se relâche, retour au défilement vertical).
- Scène 04 — plate overlap (quiet): image pleine largeur de la salle de soin; carte-citation du Dr. Benali remontée sur la photo (marge négative), glyphe de citation au trait débordant du cadre.
- Scène 05 — tarifs en table réglée: les 5 soins en table à filets (pas de cartes), prix DZD en chiffres tabulaires à espace fine, "sur devis" en italique laiton. SEAM: tone step.
- Scène 06 — contact: grille asymétrique 1fr/1.2fr — éditorial à gauche (adresse, horaires, mailto souligné laiton), formulaire en lignes réglées à droite (nom, téléphone tel-first, date souhaitée — minimum demain), état de succès qui reprend la date choisie. SEAM: weld sur le pied.
- Fermeture: colophon (adresse, horaires, © MMXXVI) puis wordmark "BENALI" bord à bord sortant de son masque.
Motif voyageur: le filet-tick laiton + la numérotation des plaques + les coordonnées. Rythme: quiet → quiet → LOUD → quiet → quiet → quiet.

SIGNATURE INTERACTION: "Parcours HUD" — pendant la galerie épinglée, le compteur serif italique 01/03 et le filet laiton se remplissent en continu; chaque panneau révèle son image par clip-path déclenché par la position horizontale.

MOTION: l'identité du monde, emphase sur la scène 03 (galerie épinglée, containerAnimation). Préloader optionnel autorisé.

SHOT LIST:
- ROLE hero background · PROMPT "editorial photography of a serene modern dental studio interior in warm dusk light, dark slate walls and warm brass details, soft window light, calm, precise, hushed, wide negative space in the upper half so display type can breathe, color world anchored to #121517 #EDE9E0 #C08A4F. No text, no logos, no watermarks, no UI." · ASPECT 16:9 · GROUP cabinet
- ROLE section scene · PROMPT "editorial photography of a dental treatment room detail, ceramic tools on dark tray, warm brass lamp glow against deep slate, macro depth, calm, meticulous, quiet, subject in the lower third with negative space above, color world anchored to #171B1E #EDE9E0 #C08A4F. No text, no logos, no watermarks, no UI." · ASPECT 4:5 · GROUP cabinet
- ROLE section scene · PROMPT "editorial photography of a minimal waiting area with a single sculptural chair and soft plant shadow on a dark warm wall, dusk light, serene, architectural, hushed, generous negative space on the left, color world anchored to #1D2226 #EDE9E0 #C08A4F. No text, no logos, no watermarks, no UI." · ASPECT 4:5 · GROUP cabinet

CONTENT FACTS: Cabinet Dentaire Benali · Dr. Lina Benali, chirurgien-dentiste · 14 Chemin des Glycines, Hydra, Alger · Tél / WhatsApp: +213 550 42 87 13 · Horaires: Dim–Jeu 9h–18h, Sam 9h–13h · Fondé en 2015 (MMXV) · Coordonnées: 36°44′ N · 3°02′ E · Soins et prix: Consultation & diagnostic 3 000 DZD; Détartrage 6 000 DZD; Blanchiment 25 000 DZD; Couronne céramique 45 000 DZD; Implantologie sur devis · Rendez-vous réservés un jour à l'avance minimum.`;

// Usage: npx tsx scripts/test-build-world.ts [worldId] [briefPath] [outName]
// No args → the original dental/Monographe baseline. With args, the brief is
// read from briefPath (a brain-format brief) and built in the named world.
async function main() {
	const [, , worldIdArg, briefPathArg, outNameArg] = process.argv;
	const worldId = worldIdArg ?? "monographe";
	const { getWorld } = await import("../src/modules/ai-chat/agent/worlds");
	const world = worldIdArg ? getWorld(worldId) : monographe;
	if (!world) throw new Error(`unknown world "${worldId}"`);

	const brief = briefPathArg
		? await readFile(briefPathArg, "utf-8")
		: BRIEF;
	const outName = outNameArg ?? `dental-${world.id}`;
	const title = brief.match(/^BUSINESS: ([^\n·—]+)/mu)?.[1]?.trim() ?? outName;

	const base = await buildSiteBuilderSystemPrompt();
	const system = `${base}\n\n${world.doc}`;
	const model = env.AI_PAGE_BUILDER_MODEL ?? env.AI_PAGE_DESIGN_MODEL;
	const attemptId = `baseline-${outName}-${Date.now()}`;

	console.log(`building with ${model}, world ${world.id}, attempt ${attemptId}`);
	const result = await runSiteBuild({
		attemptId,
		brief,
		model,
		projectId: "design-baselines",
		system,
		title,
	});

	const outDir = join(
		dirname(fileURLToPath(import.meta.url)),
		`../../../design/baselines/${outName}`,
	);
	await mkdir(outDir, { recursive: true });
	for (const file of result.files) {
		await writeFile(join(outDir, file.path), file.content);
	}
	console.log(
		`done: steps=${result.steps}, files=${result.files.length}\n` +
			`summary: ${result.summary}\nsaved to ${outDir}`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
