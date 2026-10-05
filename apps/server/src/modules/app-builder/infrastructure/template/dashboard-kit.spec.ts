import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(
	new URL("../../../../../../../", import.meta.url),
);
const sourceRoot = join(repoRoot, "templates/web-app/src");
const compiledRoot = mkdtempSync(join(tmpdir(), "dashboard-kit-"));
// A DOM run loads React and Radix; this bound also catches a hanging focus trap.
const childTimeoutMs = 10_000;
// Vitest allows setup time in addition to the child process limit.
const componentTestTimeoutMs = 15_000;
const sources = [
	"shared/lib/utils.ts",
	"shared/ui/button.tsx",
	"shared/ui/card.tsx",
	"shared/ui/icons.tsx",
	"shared/ui/sheet.tsx",
	"shared/ui/dashboard-shell.tsx",
	"shared/ui/dashboard-content.tsx",
];

beforeAll(() => {
	// CI installs workspace dependencies. The standalone template needs no separate install for these tests.
	symlinkSync(
		join(repoRoot, "packages/ui/node_modules"),
		join(compiledRoot, "node_modules"),
	);
	for (const source of sources) {
		const target = join(compiledRoot, source.replace(/\.tsx?$/, ".cjs"));
		mkdirSync(dirname(target), { recursive: true });
		const compiled = ts.transpileModule(
			readFileSync(join(sourceRoot, source), "utf8"),
			{
				compilerOptions: {
					jsx: ts.JsxEmit.ReactJSX,
					module: ts.ModuleKind.CommonJS,
				},
				fileName: source,
			},
		);
		// Preserve template aliases while loading the real compiled components in Node.
		writeFileSync(
			target,
			compiled.outputText.replace(
				/require\("~\/([^"]+)"\)/g,
				(_match: string, path: string) =>
					`require(${JSON.stringify(join(compiledRoot, `${path}.cjs`))})`,
			),
		);
	}
});

afterAll(() => rmSync(compiledRoot, { recursive: true, force: true }));

function runComponentScript(script: string) {
	const result = spawnSync(process.execPath, ["-e", script], {
		cwd: compiledRoot,
		encoding: "utf8",
		timeout: childTimeoutMs,
	});
	expect(result.error).toBeUndefined();
	expect(result.status, result.stderr).toBe(0);
	return result.stdout;
}

const renderImports = `
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {DashboardBody} = require('./shared/ui/dashboard-content.cjs');
const h = React.createElement;
`;

describe("generated dashboard kit", { timeout: componentTestTimeoutMs }, () => {
	it("keeps zero values and omits null or boolean content slots", () => {
		const markup = runComponentScript(`${renderImports}
process.stdout.write(renderToStaticMarkup(h('div',null,
 h('section',{'data-case':'zero'},h(DashboardBody,{layout:'analytics',primary:'Primary',metrics:0,secondary:0})),
 h('section',{'data-case':'null'},h(DashboardBody,{layout:'analytics',primary:'Primary',metrics:null,secondary:null})),
 h('section',{'data-case':'false'},h(DashboardBody,{layout:'analytics',primary:'Primary',metrics:false,secondary:false})),
 h('section',{'data-case':'true'},h(DashboardBody,{layout:'analytics',primary:'Primary',metrics:true,secondary:true}))
)));`);
		const page = load(markup);
		const metricGrid = page("[data-case=zero] > div > div").first();
		expect(metricGrid.hasClass("sm:grid-cols-2")).toBe(true);
		expect(metricGrid.text()).toBe("0");
		expect(
			page("[data-case=zero] [data-dashboard-body]").children(),
		).toHaveLength(2);
		expect(
			page("[data-case=zero] [data-dashboard-body]").children().last().text(),
		).toBe("0");
		for (const absent of ["null", "false", "true"]) {
			expect(page(`[data-case=${absent}] > div > div`)).toHaveLength(1);
			expect(
				page(`[data-case=${absent}] [data-dashboard-body]`).children(),
			).toHaveLength(1);
			expect(page(`[data-case=${absent}]`).text()).toBe("Primary");
		}
	});

	it(
		"closes the mobile sheet through selection, Escape, close button, and desktop resize",
		() => {
			const workspaceRequire = JSON.stringify(
				resolve(repoRoot, "apps/web/package.json"),
			);
			runComponentScript(`
const assert = require('node:assert/strict');
const webRequire = require('node:module').createRequire(${workspaceRequire});
const {JSDOM} = webRequire('jsdom');
const dom = new JSDOM('<!doctype html><html dir="rtl"><body></body></html>',{url:'http://localhost',pretendToBeVisual:true});
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','Element','Node','NodeFilter','CustomEvent','Event','MutationObserver']) {
  Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const listeners = new Set();
window.matchMedia = () => ({matches:false,addEventListener:(_,listener)=>listeners.add(listener),removeEventListener:(_,listener)=>listeners.delete(listener)});
const React = require('react');
const {render,fireEvent,screen,waitFor,cleanup,act} = webRequire('@testing-library/react');
const {DashboardShell,DashboardNavItem} = require('./shared/ui/dashboard-shell.cjs');
const h = React.createElement;
async function check() {
  render(h(DashboardShell, {variant:'rail',brand:'Workspace',navigationLabel:'التنقل',openNavigationLabel:'فتح القائمة',closeNavigationLabel:'إغلاق القائمة',skipToContentLabel:'انتقل إلى المحتوى',
    navigation:close=>h(DashboardNavItem,{active:true},h('a',{href:'#queue',onClick:close},'قائمة العمل'))
  },h('h1',null,'Overview')));
  const trigger = screen.getByRole('button',{name:'فتح القائمة'});
  const open = async () => {
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog',{name:'التنقل'});
    assert.ok(dialog.contains(document.activeElement));
    assert.equal(trigger.getAttribute('aria-expanded'),'true');
    return dialog;
  };
  const closed = async () => {
    await waitFor(()=>assert.equal(screen.queryByRole('dialog'),null));
    await waitFor(()=>assert.equal(document.activeElement,trigger));
    assert.equal(trigger.getAttribute('aria-expanded'),'false');
  };
	  const dialog = await open();
  const closeButton = screen.getByRole('button',{name:'إغلاق القائمة'});
  closeButton.focus();
  fireEvent.keyDown(dialog,{key:'Tab'});
  assert.equal(document.activeElement,dialog.querySelector('a'));
  fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true});
  assert.equal(document.activeElement,closeButton);
  document.querySelector('main').focus();
  assert.ok(dialog.contains(document.activeElement));
  fireEvent.click(dialog.querySelector('a'));
  await closed();
  await open();
  fireEvent.keyDown(document,{key:'Escape'});
  await closed();
  await open();
  fireEvent.click(screen.getByRole('button',{name:'إغلاق القائمة'}));
  await closed();
  await open();
  act(()=>{for(const listener of listeners)listener({matches:false});});
  assert.ok(screen.getByRole('dialog'));
  act(()=>{for(const listener of listeners)listener({matches:true});});
  await closed();
  cleanup();
  assert.equal(listeners.size,0);
  dom.window.close();
}
check().catch(error=>{console.error(error);process.exitCode=1;});`);
		},
		componentTestTimeoutMs,
	);
});
