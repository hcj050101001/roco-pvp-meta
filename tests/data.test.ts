import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadData } from '../src/lib/data';
import type { Lineup } from '../src/lib/schema';
import { allLineups } from '../src/lib/data';

const sample = () => {
  const lineup = structuredClone(allLineups[0]);
  lineup.id = 'fixture-s4';
  lineup.slug = 'fixture-s4';
  lineup.season = 'S4';
  lineup.status = 'active';
  lineup.archive_reason = null;
  return lineup;
};

function fixture(options: {
  state?: unknown;
  seasons?: unknown;
  lineups?: Lineup[];
  archive?: Lineup[];
}) {
  const root = mkdtempSync(join(tmpdir(), 'roco-data-'));
  mkdirSync(join(root, 'data', 'lineups'), { recursive: true });
  mkdirSync(join(root, 'data', 'archive'), { recursive: true });
  writeFileSync(join(root, 'data', 'update-state.json'), JSON.stringify(options.state ?? { season: 'S4', version_label: '测试版本' }));
  writeFileSync(join(root, 'data', 'seasons.json'), JSON.stringify(options.seasons ?? []));
  for (const lineup of options.lineups ?? []) writeFileSync(join(root, 'data', 'lineups', `${lineup.slug}.json`), JSON.stringify(lineup));
  for (const lineup of options.archive ?? []) writeFileSync(join(root, 'data', 'archive', `${lineup.slug}.json`), JSON.stringify(lineup));
  return root;
}

test('loadData(root) 只读取指定根目录，currentSeason 缺失时可回退', () => {
  const root = fixture({
    state: { season: 'S4', version_label: '根目录版本', theme: 'light' },
    seasons: [{ id: 'S4', name: '根目录赛季', intro: '根目录简介' }],
    lineups: [sample()],
  });
  try {
    const data = loadData(root);
    assert.deepEqual(data.allLineups.map(l => l.slug), ['fixture-s4']);
    assert.equal(data.state.version_label, '根目录版本');
    assert.equal(data.seasons.length, 1);
    assert.equal(data.currentSeason.name, '根目录赛季');
    assert.equal(data.currentSeason.intro, '根目录简介');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const missing = fixture({
    state: { season: 'S5', version_label: '未登记版本', theme: 'dark' },
    seasons: [],
    lineups: [sample()],
  });
  try {
    const season = loadData(missing).currentSeason;
    assert.deepEqual(season, { id: 'S5', name: '未登记版本', theme: 'dark', intro: '' });
  } finally {
    rmSync(missing, { recursive: true, force: true });
  }
});

test('归档目录只接受 archived，文件名必须与 slug 一致', () => {
  const archived = sample();
  archived.status = 'archived';
  archived.archive_reason = '测试归档';
  const valid = fixture({ archive: [archived] });
  try {
    assert.deepEqual(loadData(valid).allLineups.map(l => l.slug), ['fixture-s4']);
    assert.deepEqual(loadData(valid).historyLineups.map(l => l.slug), ['fixture-s4']);
  } finally {
    rmSync(valid, { recursive: true, force: true });
  }

  const activeInArchive = fixture({ archive: [sample()] });
  try {
    assert.throws(() => loadData(activeInArchive), /归档目录只接受 archived/);
  } finally {
    rmSync(activeInArchive, { recursive: true, force: true });
  }

  const mismatched = fixture({ lineups: [sample()] });
  try {
    writeFileSync(join(mismatched, 'data', 'lineups', 'wrong-name.json'), JSON.stringify(sample()));
    assert.throws(() => loadData(mismatched), /文件名与 slug 不一致/);
  } finally {
    rmSync(mismatched, { recursive: true, force: true });
  }
});

test('update-state 缺少 season/version_label 时直接失败', () => {
  const root = fixture({ state: { season: 'S4' } });
  try {
    assert.throws(() => loadData(root), /缺少 season\/version_label/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
