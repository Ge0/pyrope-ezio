import * as esbuild from 'esbuild';
import { readFile } from 'node:fs/promises';

const header = await readFile('./userscript-header.txt', 'utf8');

await esbuild.build({
    entryPoints: ['./src/main.ts'],
    bundle: true,
    format: 'iife',
    outfile: './dist/pyrope-plugin-ezio.js',
    banner: {
        js: header,
    },
});

console.log('✓ Pyrope plugin built.');