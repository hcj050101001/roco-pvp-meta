import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export async function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) throw Error('只允许公开 HTTPS URL');
  const host = u.hostname.replace(/^\[|\]$/g,'');
  if (host === 'localhost' || isIP(host) || host.endsWith('.local')) throw Error('不允许本地地址');
  const addresses = await lookup(host,{all:true});
  if (addresses.some(({address}) => /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|f[cd]|fe80)/i.test(address))) throw Error('拒绝私有网络地址');
  return u;
}
export async function publicFetch(url: string, maxBytes = 12_000_000) {
  let target = url;
  for (let i=0;i<5;i++) {
    await assertPublicUrl(target);
    const r = await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'RocoEvidenceBot/1.0 (+https://github.com/hcj050101001/roco-pvp-meta)'}});
    if (r.status>=300 && r.status<400 && r.headers.get('location')) { target = new URL(r.headers.get('location')!,target).href; continue; }
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    if (Number(r.headers.get('content-length') || 0)>maxBytes) throw Error('响应超过大小限制');
    const chunks: Uint8Array[] = []; let size=0;
    if (r.body) for await (const chunk of r.body) { size+=chunk.length; if(size>maxBytes) throw Error('响应超过大小限制'); chunks.push(chunk); }
    return {body:Buffer.concat(chunks),type:r.headers.get('content-type') || '',url:target};
  }
  throw Error('重定向次数超限');
}
