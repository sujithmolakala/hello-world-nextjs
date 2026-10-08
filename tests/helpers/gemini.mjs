import ts from 'typescript';
import { readFile } from 'node:fs/promises';
// Load the actual production modules in Node without Next's server-only marker.
// No test-only generation behavior is added to the app.
function moduleUrl(source) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const validationUrl = moduleUrl(await readFile(new URL('../../src/lib/validation.ts', import.meta.url), 'utf8'));
export const validation = await import(validationUrl);
export const gemini = await import(moduleUrl((await readFile(new URL('../../src/lib/gemini.ts', import.meta.url), 'utf8')).replace("import 'server-only';", '').replace("'./validation'", JSON.stringify(validationUrl))));
