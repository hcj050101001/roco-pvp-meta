import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { LookupAddress } from 'node:dns';
import type { RequestOptions } from 'node:https';
import {
  assertConnectedAddress,
  assertPublicUrl,
  canonicalIp,
  isPrivateAddress,
  networkDeps,
  pinnedLookup,
  publicFetch,
  type ResolvedAddress,
} from '../scripts/collect/network';

let exclusive: Promise<void> = Promise.resolve();

async function withDeps(
  patch: Partial<Pick<typeof networkDeps, 'lookup' | 'httpsRequest'>>,
  run: () => Promise<void>,
) {
  const previous = { lookup: networkDeps.lookup, httpsRequest: networkDeps.httpsRequest };
  const job = exclusive.then(async () => {
    Object.assign(networkDeps, patch);
    try {
      await run();
    } finally {
      Object.assign(networkDeps, previous);
    }
  });
  exclusive = job.then(
    () => undefined,
    () => undefined,
  );
  await job;
}

test('canonicalIp 折叠映射地址和 IPv6 写法', () => {
  assert.equal(canonicalIp('::ffff:127.0.0.1'), '127.0.0.1');
  assert.equal(canonicalIp('::ffff:7f00:1'), '127.0.0.1');
  assert.equal(canonicalIp('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
});

test('isPrivateAddress 拒绝私有、链路本地和映射地址', () => {
  for (const address of [
    '127.0.0.1',
    '10.1.2.3',
    '192.168.0.4',
    '172.16.5.1',
    '169.254.169.254',
    '0.1.2.3',
    '::1',
    'fc00::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:a9fe:a9fe',
  ])
    assert.equal(isPrivateAddress(address), true, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '172.32.0.1', '2001:4860:4860::8888'])
    assert.equal(isPrivateAddress(address), false, address);
});

test('isPrivateAddress 拦截 CGNAT /10，允许相邻地址', () => {
  for (const address of ['100.64.0.1', '100.127.255.255', '::ffff:100.64.0.1'])
    assert.equal(isPrivateAddress(address), true, address);
  for (const address of ['100.63.255.255', '100.128.0.1'])
    assert.equal(isPrivateAddress(address), false, address);
});

test('assertConnectedAddress 只接受本次核验过的公开地址', () => {
  const allowed: ResolvedAddress[] = [{ address: '1.1.1.1', family: 4 }];
  assert.doesNotThrow(() => assertConnectedAddress('1.1.1.1', allowed));
  assert.doesNotThrow(() => assertConnectedAddress('::ffff:1.1.1.1', allowed));
  assert.throws(() => assertConnectedAddress('8.8.8.8', allowed), /不一致/);
  assert.throws(() => assertConnectedAddress('127.0.0.1', allowed), /私有/);
  assert.throws(() => assertConnectedAddress(undefined, allowed), /私有/);
});

test('pinnedLookup 只返回已核验地址', () => {
  const lookup = pinnedLookup([{ address: '1.1.1.1', family: 4 }]);
  lookup('rebind.example', { all: true }, (err, addresses) => {
    assert.equal(err, null);
    assert.deepEqual(addresses, [{ address: '1.1.1.1', family: 4 }]);
  });
  lookup('rebind.example', {}, (err, address, family) => {
    assert.equal(err, null);
    assert.equal(address, '1.1.1.1');
    assert.equal(family, 4);
  });
});

test('assertPublicUrl 拒绝非公开目标', async () => {
  await assert.rejects(() => assertPublicUrl('http://example.com/'), /HTTPS/);
  await assert.rejects(() => assertPublicUrl('https://user:pass@example.com/'), /HTTPS/);
  await assert.rejects(() => assertPublicUrl('https://example.com:8443/'), /HTTPS/);
  await assert.rejects(() => assertPublicUrl('https://127.0.0.1/'), /本地/);
  await assert.rejects(() => assertPublicUrl('https://localhost/secret'), /本地/);
  await withDeps({ lookup: async () => [{ address: '127.0.0.1', family: 4 }] }, async () => {
    await assert.rejects(() => assertPublicUrl('https://rebind.example/a'), /私有/);
  });
});

test('解析结果同时包含公网和私网地址时拒绝该主机', async () => {
  await withDeps(
    {
      lookup: async () => [
        { address: '1.1.1.1', family: 4 },
        { address: '10.0.0.2', family: 4 },
      ],
    },
    async () => {
      await assert.rejects(() => assertPublicUrl('https://mixed.example/'), /私有/);
    },
  );
});

function fakeRequest(
  onEnd: (
    url: string,
    pinned: string[],
  ) => {
    statusCode: number;
    headers: Record<string, string>;
    body?: Buffer;
    remoteAddress?: string;
  },
) {
  return (url: string, options: RequestOptions, callback: (res: EventEmitter) => void) => {
    const pinned: string[] = [];
    options.lookup?.('ignored', { all: true }, (err, addresses) => {
      if (!err && Array.isArray(addresses))
        pinned.push(...(addresses as LookupAddress[]).map((item) => item.address));
    });
    const req = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: (error?: Error) => void;
    };
    req.destroy = (error?: Error) => {
      if (error) req.emit('error', error);
    };
    req.end = () => {
      const planned = onEnd(url, pinned);
      const socket = new EventEmitter() as EventEmitter & {
        remoteAddress?: string;
        destroy: () => void;
      };
      socket.remoteAddress = planned.remoteAddress ?? pinned[0];
      socket.destroy = () => {};
      req.emit('socket', socket);
      if (
        req.listenerCount('error') &&
        planned.remoteAddress &&
        planned.remoteAddress !== pinned[0]
      )
        return;
      const res = new EventEmitter() as EventEmitter & {
        statusCode: number;
        headers: Record<string, string>;
      };
      res.statusCode = planned.statusCode;
      res.headers = planned.headers;
      callback(res);
      if (planned.body) res.emit('data', planned.body);
      res.emit('end');
    };
    return req;
  };
}

test('publicFetch 每一跳都核验，并且只连接该跳已解析的地址', async () => {
  const hosts: string[] = [];
  const lookups: string[][] = [];
  let calls = 0;
  await withDeps(
    {
      lookup: async (host: string) => {
        hosts.push(host);
        return [{ address: host === 'second.example' ? '8.8.8.8' : '1.1.1.1', family: 4 }];
      },
      httpsRequest: fakeRequest(
        (_url, pinned): { statusCode: number; headers: Record<string, string>; body?: Buffer } => {
          calls += 1;
          lookups.push(pinned);
          if (calls === 1)
            return { statusCode: 302, headers: { location: 'https://second.example/next' } };
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/plain' },
            body: Buffer.from('ok'),
          };
        },
      ) as typeof networkDeps.httpsRequest,
    },
    async () => {
      const result = await publicFetch('https://first.example/start', 1000, 1000);
      assert.equal(result.body.toString(), 'ok');
      assert.equal(result.url, 'https://second.example/next');
      assert.deepEqual(hosts, ['first.example', 'second.example']);
      assert.deepEqual(lookups, [['1.1.1.1'], ['8.8.8.8']]);
    },
  );
});

test('publicFetch 拒绝跳转到本地地址', async () => {
  let calls = 0;
  await withDeps(
    {
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      httpsRequest: fakeRequest(() => {
        calls += 1;
        return { statusCode: 302, headers: { location: 'https://127.0.0.1/secret' } };
      }) as typeof networkDeps.httpsRequest,
    },
    async () => {
      await assert.rejects(() => publicFetch('https://first.example/start', 1000, 1000), /本地/);
      assert.equal(calls, 1);
    },
  );
});

test('实际连接地址若与核验结果不一致则中止', async () => {
  await withDeps(
    {
      lookup: async () => [{ address: '1.1.1.1', family: 4 }],
      httpsRequest: fakeRequest(() => ({
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: Buffer.from('nope'),
        remoteAddress: '127.0.0.1',
      })) as typeof networkDeps.httpsRequest,
    },
    async () => {
      await assert.rejects(() => publicFetch('https://rebind.example/a', 1000, 1000), /私有/);
    },
  );
});
