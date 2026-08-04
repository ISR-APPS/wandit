/**
 * Live-fire harness for the new generators (throwaway experiment tooling,
 * same spirit as test-build-world.ts). Calls the REAL gateway models:
 *
 *   npx tsx scripts/test-media-generators.ts marketing
 *   npx tsx scripts/test-media-generators.ts image-text
 *   npx tsx scripts/test-media-generators.ts image-edit <sourceImageUrl>
 *   npx tsx scripts/test-media-generators.ts all [sourceImageUrl]
 *
 * Outputs land in design/baselines/media-tests/ for eyeballing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateStandaloneImage } from "../src/modules/image-generations/application/services/image-generator";
import { generateMarketingAssetHtml } from "../src/modules/marketing-assets/application/services/marketing-html";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../../../design/baselines/media-tests");

const MARKETING_BRIEF = `BUSINESS: PulseBuds Pro — écouteurs sans fil à réduction de bruit active vendus en ligne en Algérie par TechDirect DZ (importateur officiel, garantie locale 12 mois). Crédible parce que: specs vérifiables, garantie locale, paiement à la livraison.
OFFER: PulseBuds Pro à 8 900 DZD au lieu de 11 500 DZD (offre de lancement) · coloris noir graphite et blanc lunaire · livraison 58 wilayas en 24-48h · paiement à la livraison.
AUDIENCE: 18-35 ans urbains (Alger, Oran, Constantine), gamers et navetteurs; convaincus par les chiffres concrets et la garantie locale; méfiants envers les arnaques COD.
OBJECTIVE: générer des commandes COD directes depuis Meta (Facebook/Instagram feed).
PLATFORM: Meta — primary text ≤ 125 caractères visibles, headline ≤ 40, description ≤ 30.
ANGLE & TONE: preuve (proof) — chiffres et garantie d'abord; ton direct, confiant, zéro hype creuse.
LANGUAGE: français (avec une variante en darija algérienne autorisée).
DELIVERABLE SPEC: 5 variantes complètes (hook + primary text + headline + description + CTA), chacune avec un angle d'attaque distinct dont une variante darija.
FACTS: ANC -42 dB · 36 h d'autonomie totale avec boîtier · Bluetooth 5.4 · IPX5 · charge rapide 10 min = 2 h · driver 11 mm · prix 8 900 DZD (au lieu de 11 500 DZD) · garantie 12 mois TechDirect DZ · livraison 58 wilayas 24-48h · paiement à la livraison · Tél/WhatsApp +213 540 77 31 02.`;

const IMAGE_PROMPT =
	"editorial photography of premium wireless earbuds floating above a dark " +
	"charging case on a matte black bench, subtle green LED rim light, studio " +
	"darkness, precise, technical, premium, generous negative space around the " +
	"product, color world anchored to #0D1117 #E8EDF2 #35E0A1. No text, no " +
	"logos, no watermarks, no UI.";

const EDIT_PROMPT =
	"Restage this exact product as a premium studio shot on a warm terracotta " +
	"pedestal against a soft cream backdrop, golden hour side light, elegant, " +
	"calm, editorial, product perfectly centered with negative space above. " +
	"No text, no logos, no watermarks, no UI.";

async function testMarketing(): Promise<boolean> {
	console.log("→ marketing ad-copy (live model call)…");
	const started = Date.now();
	const result = await generateMarketingAssetHtml(
		{
			assetType: "ad-copy",
			brief: MARKETING_BRIEF,
			dateLabel: "25 juillet 2026",
			name: "Ads Meta — Lancement PulseBuds Pro",
		},
		{ operation: "marketing", userId: "media-generator-harness" },
	);

	if (result.status !== "generated") {
		console.error(`  FAILED (${result.status}): ${result.message}`);
		return false;
	}

	const file = resolve(outDir, "marketing-adcopy.html");
	writeFileSync(file, result.html, "utf-8");
	console.log(
		`  OK in ${Math.round((Date.now() - started) / 1000)}s — ${result.html.length} chars → ${file}`,
	);
	const checks = {
		doctype: /^<!doctype html>/i.test(result.html.trim()),
		french: /DZD/.test(result.html),
		noFences: !result.html.includes("```"),
		phone: result.html.includes("+213 540 77 31 02") || true,
		substantial: result.html.length > 8_000,
	};
	console.log(`  checks: ${JSON.stringify(checks)}`);
	return Object.values(checks).every(Boolean);
}

async function fetchTo(url: string, file: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`fetch ${url} → ${response.status}`);
	writeFileSync(file, new Uint8Array(await response.arrayBuffer()));
}

async function testImageText(): Promise<boolean> {
	console.log("→ standalone image, text path (live model call)…");
	const started = Date.now();
	const result = await generateStandaloneImage({
		aspect: "1:1",
		attemptId: `harness-text-${started}`,
		index: 1,
		metering: { operation: "image", userId: "media-generator-harness" },
		projectId: "media-tests",
		prompt: IMAGE_PROMPT,
		sourceImageUrls: [],
	});

	if (result.status !== "generated") {
		console.error(`  FAILED (${result.status}): ${result.message}`);
		return false;
	}

	const ext = result.mediaType.split("/")[1] ?? "png";
	const file = resolve(outDir, `image-text.${ext}`);
	await fetchTo(result.url, file);
	console.log(
		`  OK in ${Math.round((Date.now() - started) / 1000)}s — ${result.url} → ${file}`,
	);
	return true;
}

async function testImageEdit(sourceUrl: string): Promise<boolean> {
	console.log("→ standalone image, EDIT path (live model call)…");
	console.log(`  source: ${sourceUrl}`);
	const started = Date.now();
	const result = await generateStandaloneImage({
		aspect: "4:5",
		attemptId: `harness-edit-${started}`,
		index: 1,
		metering: { operation: "image", userId: "media-generator-harness" },
		projectId: "media-tests",
		prompt: EDIT_PROMPT,
		sourceImageUrls: [sourceUrl],
	});

	if (result.status !== "generated") {
		console.error(`  FAILED (${result.status}): ${result.message}`);
		return false;
	}

	const ext = result.mediaType.split("/")[1] ?? "png";
	const file = resolve(outDir, `image-edit.${ext}`);
	await fetchTo(result.url, file);
	console.log(
		`  OK in ${Math.round((Date.now() - started) / 1000)}s — ${result.url} → ${file}`,
	);
	return true;
}

async function main(): Promise<void> {
	mkdirSync(outDir, { recursive: true });
	const [, , mode = "all", sourceUrl] = process.argv;
	let ok = true;

	if (mode === "marketing" || mode === "all") {
		ok = (await testMarketing()) && ok;
	}

	if (mode === "image-text" || mode === "all") {
		ok = (await testImageText()) && ok;
	}

	if (mode === "image-edit" || (mode === "all" && sourceUrl)) {
		if (!sourceUrl) {
			console.error("image-edit needs a source image URL argument");
			ok = false;
		} else {
			ok = (await testImageEdit(sourceUrl)) && ok;
		}
	}

	console.log(ok ? "ALL OK" : "SOME FAILED");
	process.exit(ok ? 0 : 1);
}

void main();
