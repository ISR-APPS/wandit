import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const specDir = dirname(fileURLToPath(import.meta.url));
const templateRoot = resolve(
	specDir,
	"..",
	"..",
	"..",
	"..",
	"..",
	"..",
	"..",
	"templates",
	"web-app",
);

/** A fixture page of the app area (strict scope). */
const PAGE = "src/features/demo/components/demo-page.tsx";
/** A fixture page of the public landing feature (color rules only). */
const LANDING_PAGE = "src/features/landing/components/hero.tsx";
/** A fixture route behind login (strict scope). */
const APP_ROUTE = "src/routes/app/reports.tsx";

const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

/**
 * Builds a fixture template in a new temp folder: the real script and engine.css, then the row files.
 * Then it runs the script there. The script finds the template root from its own path.
 */
function runCheck(files: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), "check-theme-"));
	tempRoots.push(root);
	for (const path of ["scripts/check-theme.mjs", "src/styles/engine.css"]) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		copyFileSync(join(templateRoot, path), join(root, path));
	}
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return spawnSync("node", [join(root, "scripts", "check-theme.mjs")], {
		encoding: "utf8",
	});
}

/** A fixture page: one component that returns the JSX lines. Line 2 is the first JSX line. */
function page(...jsx: string[]) {
	return ["export const Demo = () => (", ...jsx, ");", ""].join("\n");
}

/** One fixture tree, the exit code it must give, and one text that the output must hold. */
type CheckCase = {
	name: string;
	/** Path in the template, mapped to the file text. */
	files: Record<string, string>;
	/** 1 when the script reports a finding, else 0. */
	status: number;
	/** For a failure, "file:line: rule:", the start of one finding line on stderr. */
	output: string;
};

describe("check-theme.mjs", () => {
	it.each<CheckCase>([
		{
			name: "fails on a palette class after a URL string on the same line",
			files: {
				[PAGE]: page(
					'\t<a href="https://example.com" className="bg-blue-500">x</a>',
				),
			},
			status: 1,
			output: `${PAGE}:2: palette:`,
		},
		{
			name: "fails on a palette class on a line after image/* in JSX text",
			files: {
				[PAGE]: page(
					"\t<div>",
					"\t\t<p>Formats: image/*, PDF</p>",
					'\t\t<div className="bg-blue-500" />',
					"\t</div>",
				),
			},
			status: 1,
			output: `${PAGE}:4: palette:`,
		},
		{
			name: "fails on a white color class with an opacity",
			files: { [PAGE]: page('\t<p className="p-4 text-white/80">x</p>') },
			status: 1,
			output: `${PAGE}:2: palette:`,
		},
		{
			name: "fails on an arbitrary hex color class",
			files: { [PAGE]: page('\t<div className="bg-[#0f172a]" />') },
			status: 1,
			output: `${PAGE}:2: literal:`,
		},
		{
			name: "fails on an oklch color in a style prop",
			files: {
				[PAGE]: page('\t<div style={{ color: "oklch(0.6 0.2 30)" }} />'),
			},
			status: 1,
			output: `${PAGE}:2: literal:`,
		},
		{
			name: "fails on a fixed Tailwind shadow behind a variant",
			files: { [PAGE]: page('\t<div className="hover:shadow-lg" />') },
			status: 1,
			output: `${PAGE}:2: shadow:`,
		},
		{
			name: "fails on an emoji in JSX text",
			files: { [PAGE]: page("\t<span>🚀</span>") },
			status: 1,
			output: `${PAGE}:2: emoji:`,
		},
		{
			name: "fails on uppercase in the app area, also under an ignore line with a reason",
			files: {
				[PAGE]: page(
					"\t<p",
					"\t\t// theme-check: ignore caps the brand name is in capitals",
					'\t\tclassName="uppercase"',
					"\t/>",
				),
			},
			status: 1,
			output: `${PAGE}:4: caps:`,
		},
		{
			name: "fails on a wide tracking in a route file under routes/app/",
			files: { [APP_ROUTE]: page('\t<p className="tracking-widest">x</p>') },
			status: 1,
			output: `${APP_ROUTE}:2: caps:`,
		},
		{
			name: "fails on a square corner on one side",
			files: { [PAGE]: page('\t<div className="rounded-t-none" />') },
			status: 1,
			output: `${PAGE}:2: radius:`,
		},
		{
			name: "fails on a 3px border on one side",
			files: { [PAGE]: page('\t<div className="border-s-3" />') },
			status: 1,
			output: `${PAGE}:2: ink:`,
		},
		{
			name: "fails on a fill in a foreground token",
			files: { [PAGE]: page('\t<div className="bg-(--card-foreground)" />') },
			status: 1,
			output: `${PAGE}:2: ink:`,
		},
		{
			name: "fails on a fill on a CardHeader tag over several lines",
			files: {
				[PAGE]: page(
					"\t<Card>",
					"\t\t<CardHeader",
					'\t\t\tclassName="border-b bg-muted"',
					"\t\t>",
					"\t\t\tx",
					"\t\t</CardHeader>",
					"\t</Card>",
				),
			},
			status: 1,
			output: `${PAGE}:3: ink:`,
		},
		{
			name: "fails on an arbitrary font",
			files: { [PAGE]: page('\t<p className="font-[Inter]">x</p>') },
			status: 1,
			output: `${PAGE}:2: font:`,
		},
		{
			name: "fails on an import of another icon package, also on a public page",
			files: {
				[LANDING_PAGE]: [
					"import {",
					"\tStoreIcon,",
					'} from "lucide-react";',
					"",
				].join("\n"),
			},
			status: 1,
			output: `${LANDING_PAGE}:3: icons:`,
		},
		{
			name: "fails on an import of the Phosphor SSR icons, which ignore the theme weight",
			files: {
				[PAGE]: 'import { GearIcon } from "@phosphor-icons/react/ssr";\n',
			},
			status: 1,
			output: `${PAGE}:1: icons:`,
		},
		{
			name: "fails on an icon of the Phosphor SSR namespace",
			files: { [PAGE]: page("\t<SSR.StarIcon />") },
			status: 1,
			output: `${PAGE}:2: icons:`,
		},
		{
			name: "fails on an import of the Phosphor SSR namespace from the package root",
			files: {
				[PAGE]: [
					'import { SSR } from "@phosphor-icons/react";',
					"const { StarIcon } = SSR;",
					"",
				].join("\n"),
			},
			status: 1,
			output: `${PAGE}:1: icons:`,
		},
		{
			name: "fails on another Phosphor package, which ignores the theme weight",
			files: { [PAGE]: 'import "@phosphor-icons/web/regular";\n' },
			status: 1,
			output: `${PAGE}:1: icons:`,
		},
		{
			name: "fails when the root route drops the IconContext provider of the icons axis",
			files: {
				"src/routes/__root.tsx": [
					"export const Root = ({ theme }) => (",
					"\t<html",
					"\t\t{...themeAttributesOf(theme)}",
					"\t\tstyle={themeStyleOf(theme)}",
					"\t\tdata-icons={theme.selection.icons}",
					"\t>",
					"\t\t{fontLinksOf(theme).stylesheets.length}",
					"\t</html>",
					");",
					"",
				].join("\n"),
			},
			status: 1,
			output: "src/routes/__root.tsx:1: root: <IconContext.Provider is missing",
		},
		{
			name: "fails on a React 19 IconContext provider outside the root route",
			files: {
				[PAGE]: page(
					'\t<IconContext value={{ weight: "bold" }}>',
					"\t\tx",
					"\t</IconContext>",
				),
			},
			status: 1,
			output: `${PAGE}:2: icons:`,
		},
		{
			name: "fails on a second IconContext provider outside the root route",
			files: {
				[PAGE]: page(
					'\t<IconContext.Provider value={{ weight: "bold" }}>',
					"\t\tx",
					"\t</IconContext.Provider>",
				),
			},
			status: 1,
			output: `${PAGE}:2: icons:`,
		},
		{
			name: "fails on a quoted icon weight other than fill",
			files: { [PAGE]: page('\t<CheckIcon weight="bold" />') },
			status: 1,
			output: `${PAGE}:2: icons:`,
		},
		{
			name: "fails on an icon weight other than fill in a condition",
			files: {
				[PAGE]: page('\t<StarIcon weight={isOn ? "fill" : "regular"} />'),
			},
			status: 1,
			output: `${PAGE}:2: icons:`,
		},
		{
			name: "fails on a weight variable on an icon tag",
			files: { [PAGE]: page("\t<StarIcon weight={starWeight} />") },
			status: 1,
			output: `${PAGE}:2: icons:`,
		},
		{
			name: "passes a fill weight for an on state, and a weight that is not an icon weight",
			files: {
				[PAGE]: page(
					"\t<>",
					'\t\t<StarIcon weight="fill" />',
					'\t\t<StarIcon weight={"fill"} />',
					'\t\t<HeartIcon weight={isFavorite ? "fill" : undefined} />',
					'\t\t<BellIcon weight={isMuted ? undefined : "fill"} />',
					"\t\t<HeartIcon",
					"\t\t\tweight={",
					'\t\t\t\tfavoriteProductIds.includes(product.id) ? "fill" : undefined',
					"\t\t\t}",
					"\t\t/>",
					`\t\t<HeartIcon weight={ids.includes(\`\${id}\`) ? "fill" : undefined} />`,
					'\t\t<StarIcon weight={rating?.value >= 4 ? "fill" : undefined} />',
					'\t\t<ParcelCard weight={parcel.weightKg} unit="kg" />',
					'\t\t<p title="Font weight=bold">x</p>',
					"\t</>",
				),
			},
			status: 0,
			output: "check-theme: ok",
		},
		{
			name: "passes the theme parts of the root route, a read of IconContext, a weight query in a URL, and a data-weight",
			files: {
				"src/routes/__root.tsx": [
					'import { IconContext } from "@phosphor-icons/react";',
					"export const Root = ({ theme }) => (",
					"\t<html {...themeAttributesOf(theme)} style={themeStyleOf(theme)}>",
					"\t\t{fontLinksOf(theme).stylesheets.length}",
					"\t\t<IconContext.Provider value={{ weight: theme.selection.icons }}>",
					"\t\t\tx",
					"\t\t</IconContext.Provider>",
					"\t</html>",
					");",
					"",
				].join("\n"),
				"src/shared/ui/icons/index.ts": [
					'import { IconContext } from "@phosphor-icons/react";',
					'import { useContext } from "react";',
					"export const useThemeWeight = () => useContext(IconContext).weight;",
					"",
				].join("\n"),
				[PAGE]: page(
					'\t<img src="/f.png?weight=2" data-weight="bold" alt="" />',
				),
			},
			status: 0,
			output: "check-theme: ok",
		},
		{
			name: "fails on a theme token of engine.css declared in tokens.css",
			files: { "src/styles/tokens.css": ".dark {\n\t--radius: 0px;\n}\n" },
			status: 1,
			output: "src/styles/tokens.css:2: tokens:",
		},
		{
			name: "fails on a --theme-* source variable in another CSS file",
			files: {
				"src/features/site/site.css":
					":root {\n\t--theme-light-primary: #000000;\n}\n",
			},
			status: 1,
			output: "src/features/site/site.css:2: tokens:",
		},
		{
			name: "fails on a raw color in a CSS rule",
			files: { "src/styles/tokens.css": ".brand {\n\tcolor: #dc2626;\n}\n" },
			status: 1,
			output: "src/styles/tokens.css:2: literal:",
		},
		{
			name: "fails on a Tailwind radius name with a fixed value",
			files: {
				"src/styles/tokens.css": "@theme inline {\n\t--radius-lg: 0px;\n}\n",
			},
			status: 1,
			output: "src/styles/tokens.css:2: tokens:",
		},
		{
			name: "fails on text-transform in an app utility",
			files: {
				"src/styles/tokens.css":
					"@utility eyebrow {\n\ttext-transform: uppercase;\n}\n",
			},
			status: 1,
			output: "src/styles/tokens.css:2: caps:",
		},
		{
			name: "passes caps, a wide tracking, and an ink band on a public landing page",
			files: {
				[LANDING_PAGE]: page(
					'\t<p className="rounded-none border-4 bg-foreground text-background uppercase tracking-widest">x</p>',
				),
			},
			status: 0,
			output: "check-theme: ok",
		},
		{
			name: "passes an app page of theme tokens, with color words in comments and paths",
			files: {
				[PAGE]: [
					"// text-white, bg-red-500, and uppercase in this comment are not classes.",
					"export const Demo = ({ name }: { name: string }) => (",
					'\t<Card className="rounded-surface bg-card shadow-surface">',
					'\t\t<CardHeader className="border-b bg-transparent">',
					'\t\t\t<CardTitle className="font-display tracking-tight">{name.toUpperCase()}</CardTitle>',
					"\t\t</CardHeader>",
					"\t\t{/* A JSX comment: bg-blue-500 shadow-lg 🚀 rounded-none */}",
					'\t\t<a href="https://example.com" className="rounded-lg border hover:bg-accent">',
					"\t\t\tDon't miss it © 2026 ↗",
					"\t\t</a>",
					'\t\t<img src="/images/bg-white.png" srcSet="/images/shadow-lg.png 2x" alt="" />',
					"\t</Card>",
					");",
					"",
				].join("\n"),
			},
			status: 0,
			output: "check-theme: ok",
		},
		{
			name: "passes a palette class under an ignore line with a reason",
			files: {
				[PAGE]: page(
					"\t<img",
					"\t\t// theme-check: ignore palette the brand logo needs pure white",
					'\t\tclassName="bg-white"',
					'\t\talt=""',
					"\t/>",
				),
			},
			status: 0,
			output: "check-theme: ok",
		},
		{
			name: "fails on a palette class under an ignore line with a reason under 10 characters",
			files: {
				[PAGE]: page(
					"\t<img",
					"\t\t// theme-check: ignore palette logo",
					'\t\tclassName="bg-white"',
					'\t\talt=""',
					"\t/>",
				),
			},
			status: 1,
			output: `${PAGE}:4: palette:`,
		},
	])("$name", ({ files, status, output }) => {
		const result = runCheck(files);

		expect(result.stdout + result.stderr).toContain(output);
		expect(result.status).toBe(status);
	});
});
