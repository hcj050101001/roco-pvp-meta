import { readdir,readFile,stat } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import * as cheerio from 'cheerio';
const root=resolve('dist');
const repo=process.env.GITHUB_REPOSITORY || 'hcj050101001/roco-pvp-meta'; const [owner,name]=repo.split('/');
const base=(process.env.SITE_BASE ?? (process.env.GITHUB_ACTIONS && name!==`${owner}.github.io`?`/${name}`:'/')).replace(/\/$/,'');
async function walk(dir:string):Promise<string[]> { return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(f=>f.isDirectory()?walk(join(dir,f.name)):Promise.resolve([join(dir,f.name)])))).flat(); }
const pages=(await walk(root)).filter(f=>f.endsWith('.html')); let checks=0;
for(const page of pages) {
  const html=await readFile(page,'utf8'),$=cheerio.load(html);
  if(/[A-Z]:[\\/](?:Users|Luoke_pvp)|file:\/\//i.test(html)) throw Error(`含本机路径: ${page}`);
  if(page.includes(`${process.platform==='win32'?'\\':'/'}lineups${process.platform==='win32'?'\\':'/'}`) && $('a').filter((_,el)=>/返回阵容总览|返回往期阵容/.test($(el).text())).length<2) throw Error(`详情页缺少双返回: ${page}`);
  for(const el of $('[href], [src]').toArray()) {
    const raw=$(el).attr('href') || $(el).attr('src')!;
    if(!raw || /^(https?:|mailto:|data:|tel:)/.test(raw)) continue;
    if(raw.startsWith('//')) throw Error('不允许协议相对地址');
    const pageRelative=page.slice(root.length).replaceAll('\\','/').replace(/index\.html$/,'');
    const url=new URL(raw,`https://local.test${base}${pageRelative}`);
    if(base && !url.pathname.startsWith(base+'/')) throw Error(`资源缺少 base: ${raw}`);
    let target=resolve(root,decodeURIComponent(url.pathname.slice(base.length)).replace(/^\//,''));
    if(!target.startsWith(root)) throw Error('越界链接');
    try { const s=await stat(target); if(s.isDirectory()) target=join(target,'index.html'); await stat(target); } catch { throw Error(`静态链接缺失 ${raw} in ${page}`); }
    if(url.hash && target.endsWith('.html')) {
      const target$=cheerio.load(await readFile(target,'utf8')); const id=decodeURIComponent(url.hash.slice(1));
      if(!target$('[id]').toArray().some(e=>target$(e).attr('id')===id)) throw Error(`锚点缺失: ${raw}`);
    }
    checks++;
  }
  for(const img of $('img').toArray()) if(!$(img).attr('width') || !$(img).attr('height') || !$(img).attr('alt')) throw Error(`图片缺少尺寸或 alt: ${page}`);
}
console.log(`静态站点检查通过：${pages.length} 页，${checks} 个站内链接/资源，base=${base || '/'}`);
