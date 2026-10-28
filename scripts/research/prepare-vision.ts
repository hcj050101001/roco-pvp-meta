import { prepareVision } from './vision';
import { readLedger } from './ledger';
import { readLineups } from '../../src/lib/data';
await prepareVision(
  'research/inbox',
  await readLedger('research/candidates/image-ledger.json'),
  new Set(readLineups().flatMap((l) => l.lineup_images.map((i) => i.sha256))),
);
