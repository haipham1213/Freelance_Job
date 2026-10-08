// Biên dịch bộ component (src/design-system) thành ds-dist/ cho design-sync.
// CRA viết JSX trong .js nên cần bước này; react/react-dom để ngoài bundle.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('ds-dist', { recursive: true });
await build({
  entryPoints: ['src/design-system/index.js'],
  outfile: 'ds-dist/index.js',
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  logLevel: 'warning',
});
cpSync('src/design-system/index.d.ts', 'ds-dist/index.d.ts');
// Font Google phải @import ở đầu file CSS
const fonts = readFileSync('public/index.html', 'utf8').match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)[1].replace(/&amp;/g, '&');
writeFileSync('ds-dist/styles.css', `@import url("${fonts}");\n\n${readFileSync('src/index.css', 'utf8')}`);
console.log('ds-dist built');
