import sharp from 'sharp';
import { createHash } from 'node:crypto';

export async function imageInfo(bytes: Buffer) {
  const m = await sharp(bytes).metadata();
  if (!m.width || !m.height) throw Error('无法读取图片');
  // 64-bit DCT perceptual hash: low-frequency 8x8 coefficients, excluding DC.
  const pixels = await sharp(bytes).resize(32,32,{fit:'fill'}).greyscale().raw().toBuffer();
  const coeff: number[] = [];
  for(let u=0;u<8;u++) for(let v=0;v<8;v++) {
    let sum=0; for(let x=0;x<32;x++) for(let y=0;y<32;y++) sum+=pixels[y*32+x]*Math.cos((2*x+1)*u*Math.PI/64)*Math.cos((2*y+1)*v*Math.PI/64);
    coeff.push(sum);
  }
  const median=[...coeff.slice(1)].sort((a,b)=>a-b)[31];
  const phash=BigInt(`0b${coeff.map((v,i)=>i && v>median?'1':'0').join('')}`).toString(16).padStart(16,'0');
  const stats = await sharp(bytes).stats();
  if (stats.channels.every(c=>c.stdev<1)) throw Error('拒绝空白图片');
  return {width:m.width,height:m.height,format:m.format,sha256:createHash('sha256').update(bytes).digest('hex'),phash};
}
export function hashDistance(a:string,b:string) { return (BigInt(`0x${a}`)^BigInt(`0x${b}`)).toString(2).replaceAll('0','').length; }
