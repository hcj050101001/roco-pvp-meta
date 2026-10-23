import { writeFile } from 'node:fs/promises';
import { allLineups, state, seasons } from '../../src/lib/data';
import { siteSignature } from '../../src/lib/publish';
await writeFile('dist/build-state.json', JSON.stringify({ schema:1, signature:siteSignature(allLineups,state,seasons) })+'\n');
