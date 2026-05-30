import { cp, rm, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'xel');
const destination = join(root, 'src', 'vendor', 'xel');

try {
  await access(source);
} catch {
  console.error('xel not found in node_modules. Run `npm install` first.');
  process.exit(1);
}

await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log(`Vendored xel -> ${destination}`);
