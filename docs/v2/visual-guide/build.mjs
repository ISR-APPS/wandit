import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
let html = await readFile(path.join(directory, 'index.html'), 'utf8');
const css = await readFile(path.join(directory, 'styles.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`);
for (const filename of ['content-a.js', 'content-b.js', 'illustrations.js', 'app.js']) {
  const source = (await readFile(path.join(directory, filename), 'utf8')).replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<script src="${filename}"></script>`, () => `<script>\n${source}\n</script>`);
}
html = html.replace('data-report="../wandit-v2-report.html"', 'data-report="wandit-v2-report.html"');
const output = path.resolve(directory, '../wandit-v2-visual-guide.html');
await writeFile(output, html);
console.log(`Created ${output} (${Buffer.byteLength(html)} bytes)`);
