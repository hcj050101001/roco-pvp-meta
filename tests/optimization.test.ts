import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { allLineups, state, seasons } from '../src/lib/data';
import { siteSignature } from '../src/lib/publish';
import { readCollectionState, writeCollectionState, safeCollectionReturn } from '../src/lib/collection-state';
import { candidateAction, fingerprint, recordDecisions } from '../scripts/research/ledger';
import { mergeSources, sourceFor, retrySource, remainingImages, unprocessedImages, processedImages } from '../scripts/collect/strategy';
import { readChangeEvidence } from '../scripts/validate/change-evidence';

test('核对时间不触发发布；换季与内容变化触发发布，时间推移本身不再触发',()=>{
  // siteSignature 已改为纯内容指纹：旧版“45 天线索到期触发发布”是混入时间依赖
  // 信号优先级的副作用，已随指纹算法变更（build-state schema 2）废止。
  const signature=siteSignature(allLineups,state,seasons);
  assert.equal(siteSignature(allLineups,{...state,season_checked_at:'2026-10-24T00:00:00Z'},seasons),signature);
  assert.notEqual(siteSignature(allLineups,{...state,season:'S5'},seasons),signature);
  const next=structuredClone(allLineups);next[0].summary+=' 已核验新配置';
  assert.notEqual(siteSignature(next,state,seasons),signature);
  assert.equal(siteSignature(allLineups,state,seasons),signature);
  assert.equal(siteSignature([...allLineups].reverse(),state,seasons),signature);
});

test('筛选URL往返保留全部条件及无关参数，非法返回地址不生效',()=>{
  const original=new URL('https://example.com/roco-pvp-meta/history/?ref=guide#main');
  const value={query:'雨天',type:'天气',season:'S3',video:true,sort:'name'};
  const url=writeCollectionState(original,value);
  assert.deepEqual(readCollectionState(url,['天气'],['S3']),value);
  assert.equal(url.searchParams.get('ref'),'guide');assert.equal(url.hash,'#main');
  assert.equal(safeCollectionReturn(url.pathname+url.search+url.hash,url.origin,'/roco-pvp-meta'),url.pathname+url.search+url.hash);
  for(const bad of ['https://evil.example/','//evil.example/','/roco-pvp-meta/../other/','/roco-pvp-meta/lineups/a/','/\\evil.example/'])
    assert.equal(safeCollectionReturn(bad,url.origin,'/roco-pvp-meta'),null);
  const invalid=readCollectionState(new URL('https://example.com/?type=x&season=S99&sort=bad&video=yes'),[],[]);
  assert.deepEqual(invalid,{query:'',type:'all',season:'all',sort:'recommended',video:false});
});

test('跨轮索引复用拒绝结果，新证据和待续查到期可重新核验',()=>{
  const now=new Date('2026-10-23T00:00:00Z'),sha256='a'.repeat(64);
  const c={sha256,fingerprint:fingerprint(['page:a']),references:['https://example.com/a'],action:'review'};
  const ledger=recordDecisions({},[c],[{sha256,status:'rejected',reason:'非完整队伍'}],now);
  assert.equal(candidateAction(sha256,c.fingerprint,ledger,new Set(),now.getTime()),'reuse');
  assert.equal(candidateAction(sha256,fingerprint(['page:a','page:b']),ledger,new Set(),now.getTime()),'review');
  assert.equal(candidateAction(sha256,c.fingerprint,ledger,new Set([sha256]),now.getTime()),'published');
  const pending=recordDecisions({},[c],[{sha256,status:'pending',reason:'缺少原图'}],now);
  assert.equal(candidateAction(sha256,c.fingerprint,pending,new Set(),now.getTime()+86400000),'reuse');
  assert.equal(candidateAction(sha256,c.fingerprint,pending,new Set(),now.getTime()+14*86400000),'review');
  assert.throws(()=>recordDecisions({},[c],[]),/未记录决定/);
  assert.throws(()=>recordDecisions({},[{...c,error:'无法读取预览'}],[{sha256,status:'verified',reason:'误判'}]),/只能待续查/);
});

test('来源失败保留全部待续图片并退避；重入种子不会抹掉重试状态',()=>{
  const source=sourceFor('https://qiandao.com/post?id=1',['S4'],'backlog')!;
  source.pending_image_urls=['https://img.example/first','https://img.example/second'];
  const now=Date.parse('2026-10-23T00:00:00Z'),retry=retrySource(source,now);
  const merged=mergeSources([{...source,pending_image_urls:[]},retry])[0];
  assert.deepEqual(merged.pending_image_urls,source.pending_image_urls);
  assert.equal(merged.retry_after,'2026-10-24T00:00:00.000Z');
  assert.equal(retrySource(retry,now).retry_after,'2026-10-25T00:00:00.000Z');
  assert.deepEqual(remainingImages(source.pending_image_urls,[source.pending_image_urls[0]],['https://img.example/third']),[source.pending_image_urls[1],'https://img.example/third']);
});

test('大合集连续批次前进，证据变化或完成整轮后允许重新检查',()=>{
  const images=Array.from({length:20},(_,i)=>({url:`https://example.com/${i}.jpg`}));
  const source=sourceFor('https://qiandao.com/post?id=1',['S4'],'backlog')!;
  source.evidence_hash='a'.repeat(64);source.processed_image_urls=images.slice(0,8).map(i=>i.url);
  source.pending_image_urls=images.slice(8).map(i=>i.url);
  assert.deepEqual(unprocessedImages(images,source,source.evidence_hash).slice(0,8),images.slice(8,16));
  source.processed_image_urls=images.slice(0,16).map(i=>i.url);source.pending_image_urls=images.slice(16).map(i=>i.url);
  assert.deepEqual(unprocessedImages(images,source,source.evidence_hash),images.slice(16));
  assert.equal(unprocessedImages(images,source,'b'.repeat(64)).length,20);
  source.pending_image_urls=[];
  assert.equal(unprocessedImages(images,source,source.evidence_hash).length,20);
  source.processed_image_urls=[...processedImages(source,source.evidence_hash),...images.slice(0,8).map(i=>i.url)];
  source.pending_image_urls=images.slice(8).map(i=>i.url);
  assert.deepEqual(unprocessedImages(images,source,source.evidence_hash).slice(0,8),images.slice(8,16));
});

test('变更凭据必须匹配成功采集来源的实际文件哈希',async()=>{
  const root=await mkdtemp(join(tmpdir(),'roco-evidence-'));
  try {
    await mkdir(join(root,'inbox','test-run','source-1'),{recursive:true});
    await mkdir(join(root,'runs','test-run'),{recursive:true});
    const bytes=Buffer.from('<article>作者发布的配置</article>');
    await writeFile(join(root,'inbox','test-run','source-1','page.html'),bytes);
    const manifest={run_id:'test-run',sources:[{id:'source-1',url:'https://example.com/author',status:'ok',images:[]}]};
    await writeFile(join(root,'inbox','test-run','manifest.json'),JSON.stringify(manifest));
    const receipts=[{lineup_id:'test-team',fields:['sources'],source_url:manifest.sources[0].url,artifact_sha256:createHash('sha256').update(bytes).digest('hex'),reason:'原作者出处'}];
    const path=join(root,'runs','test-run','changes.json');await writeFile(path,JSON.stringify(receipts));
    assert.equal((await readChangeEvidence('test-run',root)).evidence.length,1);
    receipts[0].artifact_sha256='b'.repeat(64);await writeFile(path,JSON.stringify(receipts));
    await assert.rejects(readChangeEvidence('test-run',root),/哈希不匹配/);
    manifest.sources[0].status='source_fetch_failed';await writeFile(join(root,'inbox','test-run','manifest.json'),JSON.stringify(manifest));
    await assert.rejects(readChangeEvidence('test-run',root),/未成功采集/);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('roco-evidence-'));
    await rm(root,{recursive:true,force:true});
  }
});

test('候选落盘命令使用Git中的历史索引，保留旧判定并写入本轮决定',async()=>{
  const root=await mkdtemp(join(tmpdir(),'roco-ledger-'));
  try {
    const git=(args:string[])=>execFileSync('git',['-c','core.hooksPath=.no-hooks','-c','commit.gpgsign=false',...args],{cwd:root,encoding:'utf8',stdio:'pipe'});
    git(['init','--quiet']);
    await mkdir(join(root,'research','candidates'),{recursive:true});
    await mkdir(join(root,'research','inbox','test-run','vision'),{recursive:true});
    await mkdir(join(root,'research','runs','test-run'),{recursive:true});
    const sha256='a'.repeat(64),nextHash='b'.repeat(64),fp=fingerprint(['source']);
    const old=recordDecisions({},[{sha256,fingerprint:fp,references:['https://example.com/a'],action:'review'}],[{sha256,status:'rejected',reason:'旧证据不足'}]);
    const path='research/candidates/image-ledger.json';
    await writeFile(join(root,path),JSON.stringify(old));
    git(['add',path]);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture']);
    await writeFile(join(root,path),'{}'); // An artifact must not erase committed history.
    await writeFile(join(root,'research/inbox/latest.json'),JSON.stringify({run_id:'test-run'}));
    await writeFile(join(root,'research/inbox/test-run/vision/index.json'),JSON.stringify({run_id:'test-run',candidates:[{sha256:nextHash,fingerprint:fp,references:['https://example.com/b'],action:'review'}]}));
    await writeFile(join(root,'research/runs/test-run/decisions.json'),JSON.stringify([{sha256:nextHash,status:'pending',reason:'缺少完整原图'}]));
    const loader=pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
    execFileSync(process.execPath,['--import',loader,resolve('scripts/research/record-decisions.ts')],{cwd:root,stdio:'pipe'});
    const result=JSON.parse(await readFile(join(root,path),'utf8'));
    assert.deepEqual(result[sha256],old[sha256]);assert.equal(result[nextHash].status,'pending');
    assert.ok(result[nextHash].retry_after);
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('roco-ledger-'));
    await rm(root,{recursive:true,force:true});
  }
});
