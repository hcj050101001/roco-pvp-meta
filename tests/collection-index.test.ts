import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionIndex } from '../src/lib/collection-index';
import { collectionIndexSchema } from '../src/lib/collection-index-schema';

test('当季和往期索引符合共享 schema', () => {
  for (const kind of ['active', 'history'] as const) {
    const cards = collectionIndex(kind);
    assert.equal(collectionIndexSchema.safeParse(cards).success, true);
    assert.ok(cards.length > 0);
  }
});

test('索引 JSON 结构无效时 safeParse 失败', () => {
  const [card] = collectionIndex('active');
  assert.equal(collectionIndexSchema.safeParse([{ ...card, width: undefined }]).success, false);
  assert.equal(
    collectionIndexSchema.safeParse([
      { ...card, image: { ...card.image, width: '1" onload="alert(1)' } },
    ]).success,
    false,
  );
  assert.equal(collectionIndexSchema.safeParse({ cards: [card] }).success, false);
  assert.equal(
    collectionIndexSchema.safeParse([{ ...card, href: 'javascript:alert(1)' }]).success,
    false,
  );
});
