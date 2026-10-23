import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPage } from '../scripts/extract/page';
import { lineupSchema } from '../src/lib/schema';
import { allLineups } from '../src/lib/data';
import { selectActive,selectOverview,ranked,signalPriority,configurationDate } from '../src/lib/rank';
import { hashDistance } from '../scripts/extract/image';
import { guardRefresh } from '../src/lib/refresh';
import { ingestSearch } from '../scripts/collect/search';
import { officialSeason,latestLaunched,themeFor } from '../src/lib/season';

test('提取懒加载、原图、srcset、JSON-LD 与内嵌 JSON，不执行脚本',()=>{
  const r=extractPage(`<h1>阵容</h1><article>雨天队<img data-src="/a.webp"><picture><source srcset="/b.png 2x, /c.png 1x"></picture><a href="/full.jpg">原图</a></article><meta property="og:image" content="/og.png"><script type="application/ld+json">{"image":{"contentUrl":"https://cdn.example.com/ld.webp"}}</script><script>const x={"image":"https://cdn.example.com/embedded.webp"};throw Error('never execute')</script>`,'https://example.com/post');
  for(const u of ['https://example.com/a.webp','https://example.com/b.png','https://example.com/full.jpg','https://example.com/og.png','https://cdn.example.com/ld.webp','https://cdn.example.com/embedded.webp']) assert.ok(r.images.some(i=>i.url===u),u);
  assert.equal(r.title,'阵容');
});
test('缺失真实图、旧评级字段、重复成员、无依据攻略与视频都被拒绝',()=>{
  const l=structuredClone(allLineups[0]);
  assert.equal(lineupSchema.safeParse({...l,lineup_images:[]}).success,false);
  assert.equal(lineupSchema.safeParse({...l,tier:'T0'}).success,false);
  assert.equal(lineupSchema.safeParse({...l,analysis:'自编打法'}).success,false);
  assert.equal(lineupSchema.safeParse({...l,guides:[{quote:'无出处的打法'}]}).success,false);
  assert.equal(lineupSchema.safeParse({...l,guides:[{quote:'原话',author:'玩家',source_url:'https://example.com',published_at:l.first_seen_at,verified_at:l.last_verified_at}]}).success,false);
  assert.equal(lineupSchema.safeParse({...l,roster:Array(6).fill(l.roster[0])}).success,false);
  assert.equal(lineupSchema.safeParse({...l,tutorials:[{title:'泛用教学',url:'https://example.com'}]}).success,false);
  assert.equal(lineupSchema.safeParse({...l,lineup_images:l.lineup_images.map(i=>({...i,path:'/assets/lineups/../../secret.webp'}))}).success,false);
});
test('C 级单一来源不晋升；归档必须有理由',()=>{
  const l=structuredClone(allLineups[0]);
  assert.equal(lineupSchema.safeParse({...l,lineup_images:l.lineup_images.map(i=>({...i,evidence_grade:'C'}))}).success,false);
  assert.equal(lineupSchema.safeParse({...l,status:'archived',archive_reason:null}).success,false);
});
test('全面展示超过十套，并排除旧季和归档',()=>{
  const samples=Array.from({length:18},(_,i)=>({...allLineups[0],id:`x-${i}`,slug:`x-${i}`,archetype:[i<12?'雨天':'反伤']}));
  const chosen=selectActive(samples,'S4');assert.equal(chosen.length,18);
  assert.deepEqual(selectActive(samples,'S1'),[]);assert.deepEqual(selectActive(samples.map(l=>({...l,status:'archived'})),'S4'),[]);
});
test('排序只采信有时效的实绩/热度线索，不将索引复核当新配置',()=>{
  const now=Date.parse('2026-10-21T00:00:00Z'),a=structuredClone(allLineups[0]),b=structuredClone(allLineups[1]);
  a.signals=[{kind:'high-rank',note:'有来源的历史实绩',source_url:a.sources[0].url,observed_at:'2026-09-20T00:00:00Z'}];b.signals=[];
  assert.equal(ranked([b,a],now)[0].slug,a.slug);
  assert.equal(signalPriority(a,Date.parse('2026-12-01')),0);
  assert.equal(signalPriority(a,Date.parse('2026-09-01')),0);
  b.lineup_images[0].published_at=null;b.last_verified_at='2026-10-21T00:00:00Z';assert.equal(configurationDate(b),'');
  a.signals=[];a.lineup_images[0].published_at='2026-10-11T12:00:00+08:00';b.lineup_images[0].published_at='2026-10-11T05:00:00Z';
  assert.equal(ranked([a,b],now)[0].slug,b.slug);
});
test('换季过渡不清空、少量新队并存；齐备后只展示当季，旧资料仍在',()=>{
  const previous=allLineups.filter(l=>l.season==='S4');
  const empty=selectOverview(previous,'S5');assert.equal(empty.current.length,0);assert.equal(empty.fallback.length,previous.length);assert.equal(empty.transition,true);
  const single=selectOverview([...previous,{...previous[0],id:'s5-single',slug:'s5-single',season:'S5'}],'S5');
  assert.equal(single.current.length,1);assert.equal(single.fallback.length,previous.length);
  const incoming=[...previous,...Array.from({length:2},(_,i)=>({...previous[0],id:`s5-${i}`,slug:`s5-${i}`,season:'S5'}))];
  const partial=selectOverview(incoming,'S5');assert.equal(partial.current.length,2);assert.equal(partial.fallback.length,previous.length);
  incoming.push({...previous[0],id:'s5-3',slug:'s5-3',season:'S5'});
  const complete=selectOverview(incoming,'S5');assert.equal(complete.lineups.length,3);assert.equal(complete.transition,false);
  assert.equal(incoming.filter(l=>l.season==='S4').length,previous.length);
});
test('官方换季判断：只采信已发布的正式开服、拒绝未来预告和非官方作者',()=>{
  const article={ '@type':'NewsArticle',headline:'《洛克王国：世界》S5赛季「春日旅行」开服公告',description:'版本更新已全部完成，各位可登录。',datePublished:'2026-11-01T00:00:00Z',author:{url:'https://www.taptap.cn/user/99962293'}};
  const html=(a:unknown)=>`<script type="application/ld+json">${JSON.stringify(a)}</script>`;
  const url='https://www.taptap.cn/moment/123';
  assert.equal(officialSeason(html(article),url,new Date('2026-10-21')),null);
  const confirmed=officialSeason(html(article),url,new Date('2026-11-02'));assert.equal(confirmed?.id,'S5');assert.equal(confirmed?.theme,'light');
  assert.equal(officialSeason(html({...article,headline:'S5赛季「春日旅行」即将上线'}),url,new Date('2026-11-02')),null);
  assert.equal(officialSeason(html({...article,author:{url:'https://www.taptap.cn/user/other'}}),url,new Date('2026-11-02')),null);
  assert.equal(latestLaunched(confirmed?[confirmed]:[],'S6'),null);assert.equal(themeFor('月涌狂想'),'light');assert.equal(themeFor('铅字幻梦'),'light');
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

test('自动更新拒绝 OCR 猜测改名，即使来源可访问也必须留候选',()=>{
  const changed=structuredClone(allLineups);
  changed[0].roster[0].name='疑似 OCR 新名字';
  assert.throws(()=>guardRefresh(allLineups,changed,[changed[0].sources[0].url]),/不允许改写既有成员名称/);
  const fieldsOnly=structuredClone(allLineups);
  fieldsOnly[0].verification_notes+=' 已核对原图。';
  assert.throws(()=>guardRefresh(allLineups,fieldsOnly,[fieldsOnly[0].sources[0].url]),/无新证据/);
});

test('可访问旧来源也不能刷新日期；新出处必须逐字段关联证据',()=>{
  const old=structuredClone(allLineups[0]),next=structuredClone(old);
  next.last_verified_at='2026-10-23T08:00:00+08:00';
  const accessible=[old.sources[0].url];
  assert.throws(()=>guardRefresh([old],[next],accessible),/无新证据/);
  next.sources[0].last_checked_at=next.last_verified_at;
  assert.throws(()=>guardRefresh([old],[next],accessible),/无新证据/);
  const source={...old.sources[0],url:'https://example.com/original',title:'原作者配置'};
  next.sources.push(source);accessible.push(source.url);
  assert.throws(()=>guardRefresh([old],[next],accessible),/sources/);
  const receipt={lineup_id:old.id,fields:['sources'],source_url:source.url,artifact_sha256:'a'.repeat(64),reason:'原帖明确关联同一配置图'};
  assert.doesNotThrow(()=>guardRefresh([old],[next],accessible,[receipt]));
  next.summary+=' 未核验描述';
  assert.throws(()=>guardRefresh([old],[next],accessible,[receipt]),/summary/);
});
