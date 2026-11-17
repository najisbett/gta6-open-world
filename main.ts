// main.ts - the program that hands in "Salt & Neon": copies game/ and screenshots/ to the output directory and
// writes dossier.json with the kit's own buildDossier. Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Caps are the scorer's gate numbers as printed in the kit's RULES.txt and vendor/makefun-game.ts header.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
for (const d of ['game', 'screenshots']) rmSync(join(out, d), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840, // 160 KiB of source text in the dossier
    screenshots: { max: 4, max_bytes: 262144 }, // 4 images, 256 KiB each
    game_max_files: 993,
    game_max_bytes: 50331648, // 48 MiB
    game_path_max_bytes: 1000,
  }),
);
