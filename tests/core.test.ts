import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPage } from '../scripts/extract/page';
import { lineupSchema } from '../src/lib/schema';
import { allLineups } from '../src/lib/data';
import { selectActive,rankScore } from '../src/lib/rank';
import { hashDistance } from '../scripts/extract/image';
import { guardRefresh } from '../src/lib/refresh';
import { ingestSearch } from '../scripts/collect/search';

test('提取懒加载、原图、srcset、JSON-LD 与内嵌 JSON，不执行脚本',()=>{
  const r=extractPage(`<h1>阵容</h1><article>雨天队<img data-src="/a.webp"><picture><source srcset="/b.png 2x, /c.png 1x"></picture><a href="/full.jpg">原图</a></article><meta property="og:image" content="/og.png"><script type="application/ld+json">{"image":{"contentUrl":"https://cdn.example.com/ld.webp"}}</script><script>const x={"image":"https://cdn.example.com/embedded.webp"};throw Error('never execute')</script>`,'https://example.com/post');
  for(const u of ['https://example.com/a.webp','https://example.com/b.png','https://example.com/full.jpg','https://example.com/og.png','https://cdn.example.com/ld.webp','https://cdn.example.com/embedded.webp']) assert.ok(r.images.some(i=>i.url===u),u);
  assert.equal(r.title,'阵容');
});
test('active 缺失真实图、错误 Tier、重复成员、无依据视频都被拒绝',()=>{
  const l=structuredClone(allLineups[0]);
  assert.equal(lineupSchema.safeParse({...l,lineup_images:[]}).success,false);
  assert.equal(lineupSchema.safeParse({...l,tier:'T2'}).success,false);
  assert.equal(lineupSchema.safeParse({...l,roster:Array(6).fill(l.roster[0])}).success,false);
  assert.equal(lineupSchema.safeParse({...l,tutorials:[{title:'泛用教学',url:'https://example.com'}]}).success,false);
  assert.equal(lineupSchema.safeParse({...l,lineup_images:l.lineup_images.map(i=>({...i,path:'/assets/lineups/../../secret.webp'}))}).success,false);
});
test('C 级单一来源不晋升；归档必须有理由',()=>{
  const l=structuredClone(allLineups[0]);
  assert.equal(lineupSchema.safeParse({...l,lineup_images:l.lineup_images.map(i=>({...i,evidence_grade:'C'}))}).success,false);
  assert.equal(lineupSchema.safeParse({...l,status:'archived',archive_reason:null}).success,false);
});
test('排名至多十套、排除旧季和归档，并优先体系多样性',()=>{
  const samples=Array.from({length:15},(_,i)=>({...allLineups[0],id:`x-${i}`,slug:`x-${i}`,archetype:[i<12?'雨天':'反伤'],strength_score:100-i}));
  const chosen=selectActive(samples,'S4');assert.equal(chosen.length,10);assert.ok(chosen.slice(0,4).some(l=>l.archetype[0]==='反伤'));
  assert.deepEqual(selectActive(samples,'S1'),[]);assert.deepEqual(selectActive(samples.map(l=>({...l,status:'archived'})),'S4'),[]);
  assert.equal(rankScore({...samples[0],strength_score:100,popularity_score:100,evidence_score:100,recency_score:100}),100);
});
test('pHash 汉明距离',()=>{assert.equal(hashDistance('0000000000000000','000000000000000f'),4);assert.equal(hashDistance('0123456789abcdef','0123456789abcdef'),0);});
test('搜索结果仅发现支持的公开平台，拒绝伪装域名',()=>{
  const rss='<?xml version="1.0"?><rss><channel><item><link>https://ol.3dmgame.com/gl/1.html</link></item><item><link>https://bilibili.com.evil.example/video/x</link></item></channel></rss>';
  assert.deepEqual(ingestSearch(rss),['https://ol.3dmgame.com/gl/1.html']);
});
test('来源失败不删除、不误归档、不刷新验证日期',()=>{
  assert.doesNotThrow(()=>guardRefresh(allLineups,structuredClone(allLineups),[]));
  assert.throws(()=>guardRefresh(allLineups,[],[]),/硬删除/);
  const changed=structuredClone(allLineups);changed[0].last_verified_at='2026-10-22T00:00:00+08:00';
  assert.throws(()=>guardRefresh(allLineups,changed,[]),/来源均失败/);
  const archived=structuredClone(allLineups);archived[0].status='archived';archived[0].archive_reason='';
  assert.throws(()=>guardRefresh(allLineups,archived,[archived[0].sources[0].url]),/归档缺少理由/);
});
