import * as dns from 'node:dns/promises';
import https from 'node:https';
import type { LookupAddress } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';

const privateNetworks = new BlockList();
privateNetworks.addSubnet('0.0.0.0', 8, 'ipv4');
privateNetworks.addSubnet('10.0.0.0', 8, 'ipv4');
privateNetworks.addSubnet('127.0.0.0', 8, 'ipv4');
privateNetworks.addSubnet('169.254.0.0', 16, 'ipv4');
privateNetworks.addSubnet('172.16.0.0', 12, 'ipv4');
privateNetworks.addSubnet('192.168.0.0', 16, 'ipv4');
privateNetworks.addAddress('255.255.255.255', 'ipv4');
privateNetworks.addSubnet('fc00::', 7, 'ipv6');
privateNetworks.addSubnet('fe80::', 10, 'ipv6');
privateNetworks.addAddress('::', 'ipv6');
privateNetworks.addAddress('::1', 'ipv6');

export type ResolvedAddress = { address: string; family: 4 | 6 };

const USER_AGENT = 'RocoEvidenceBot/1.0 (+https://github.com/hcj050101001/roco-pvp-meta)';

// 测试替换解析和请求实现。生产路径仍走系统 DNS 与 https.request。
export const networkDeps = {
  lookup(host: string): Promise<LookupAddress[]> {
    return dns.lookup(host, { all: true, verbatim: true });
  },
  httpsRequest: https.request.bind(https) as typeof https.request,
};

export function canonicalIp(address: string): string {
  let bare = address
    .trim()
    .toLowerCase()
    .replace(/%.+$/, '')
    .replace(/^\[|\]$/g, '');
  const dotted = bare.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) bare = dotted[1];
  else {
    const hex = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = Number.parseInt(hex[1], 16);
      const lo = Number.parseInt(hex[2], 16);
      bare = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
  }
  if (bare.includes(':')) {
    try {
      return new URL(`http://[${bare}]`).hostname.slice(1, -1);
    } catch {
      return bare;
    }
  }
  return bare;
}

export function isPrivateAddress(address: string): boolean {
  const bare = canonicalIp(address);
  const family = isIP(bare);
  if (family === 0) return true;
  return privateNetworks.check(bare, family === 6 ? 'ipv6' : 'ipv4');
}

function assertHostname(hostname: string): string {
  const host = hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    isIP(host)
  )
    throw Error('不允许本地地址');
  return host;
}

async function resolvePublicHost(host: string): Promise<ResolvedAddress[]> {
  const records = await networkDeps.lookup(host);
  if (!records.length) throw Error('无法解析主机');
  if (records.some((record) => isPrivateAddress(record.address))) throw Error('拒绝私有网络地址');
  return records.map((record) => ({
    address: record.address,
    family: record.family === 6 ? 6 : 4,
  }));
}

async function checkPublicUrl(raw: string): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw Error('只允许公开 HTTPS URL');
  const addresses = await resolvePublicHost(assertHostname(url.hostname));
  return { url, addresses };
}

export async function assertPublicUrl(raw: string) {
  return (await checkPublicUrl(raw)).url;
}

export function pinnedLookup(allowed: readonly ResolvedAddress[]): LookupFunction {
  const list = allowed.map((item) => ({ address: item.address, family: item.family }));
  return (_hostname, options, callback) => {
    if (!list.length) {
      callback(Object.assign(Error('无法解析主机'), { code: 'ENOTFOUND' }), '');
      return;
    }
    if (options.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  };
}

export function assertConnectedAddress(
  remoteAddress: string | undefined,
  allowed: readonly ResolvedAddress[],
) {
  if (!remoteAddress || isPrivateAddress(remoteAddress)) throw Error('拒绝私有网络地址');
  const actual = canonicalIp(remoteAddress);
  const permitted = new Set(allowed.map((item) => canonicalIp(item.address)));
  if (!permitted.has(actual)) throw Error('连接地址与已核验的公开地址不一致');
}

function headerValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || '').trim();
}

function requestPinned(
  target: string,
  addresses: readonly ResolvedAddress[],
  timeoutMs: number,
  maxBytes: number,
): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  const agent = new https.Agent({
    keepAlive: false,
    lookup: pinnedLookup(addresses),
    autoSelectFamily: false,
    blockList: privateNetworks,
  });
  const lookup = pinnedLookup(addresses);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (
      error?: Error,
      value?: { status: number; headers: IncomingHttpHeaders; body: Buffer },
    ) => {
      if (settled) return;
      settled = true;
      agent.destroy();
      if (error) reject(error);
      else resolve(value!);
    };
    const req = networkDeps.httpsRequest(
      target,
      {
        method: 'GET',
        agent,
        lookup,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      },
      (res) => {
        const length = Number(headerValue(res.headers['content-length']) || 0);
        if (length > maxBytes) {
          res.resume();
          finish(Error('响应超过大小限制'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            finish(Error('响应超过大小限制'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          finish(undefined, {
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
        res.on('error', (error) => finish(error));
      },
    );
    req.on('socket', (socket) => {
      const check = () => {
        try {
          assertConnectedAddress(socket.remoteAddress, addresses);
        } catch (error) {
          socket.destroy();
          req.destroy(error instanceof Error ? error : Error(String(error)));
        }
      };
      if (socket.remoteAddress) check();
      else socket.once('connect', check);
    });
    req.on('error', (error) => finish(error));
    req.end();
  });
}

// 每一跳都重新解析并核验。连接使用该跳已核验的地址（自定义 lookup / Agent），
// 并在 socket 连接后再次核对实际地址，避免 DNS 重绑定落到私有网。
export async function publicFetch(url: string, maxBytes = 12_000_000, timeoutMs = 25000) {
  let target = url;
  for (let i = 0; i < 5; i++) {
    const checked = await checkPublicUrl(target);
    const response = await requestPinned(checked.url.href, checked.addresses, timeoutMs, maxBytes);
    const location = headerValue(response.headers.location);
    if (response.status >= 300 && response.status < 400 && location) {
      target = new URL(location, checked.url).href;
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw Error(`HTTP ${response.status}`);
    return {
      body: response.body,
      type: headerValue(response.headers['content-type']),
      url: checked.url.href,
    };
  }
  throw Error('重定向次数超限');
}
