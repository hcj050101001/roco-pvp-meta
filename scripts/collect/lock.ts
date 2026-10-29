import { spawnSync } from 'node:child_process';
import { closeSync, ftruncateSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

export const researchLockPath = 'research/.research.lock';

// flock 锁在本进程持有的文件描述符上。进程退出（含被杀死）后内核释放锁。
// 子进程只负责对同一 open file description 做非阻塞独占加锁，退出时不会解锁。
export function acquireResearchLock(lockPath = researchLockPath): () => void {
  mkdirSync(dirname(lockPath), { recursive: true });
  const fd = openSync(lockPath, 'a+');
  const result = spawnSync('flock', ['-n', '3'], {
    stdio: ['ignore', 'ignore', 'pipe', fd],
  });
  if (result.error || result.status === null) {
    closeSync(fd);
    throw Error(
      `无法获取研究锁（需要系统 flock 命令）：${result.error?.message || result.stderr?.toString() || 'flock 未运行'}`,
    );
  }
  if (result.status !== 0) {
    let holder = '';
    try {
      holder = readFileSync(lockPath, 'utf8').trim();
    } catch {
      // 读不到持有者 PID 时仍拒绝并行采集。
    }
    closeSync(fd);
    const pid = /^\d+$/.test(holder) ? holder : '未知';
    throw Error(`已有研究采集在运行（PID ${pid}），本次退出。锁文件：${lockPath}`);
  }
  try {
    ftruncateSync(fd, 0);
    writeSync(fd, `${process.pid}\n`, 0);
  } catch (error) {
    closeSync(fd);
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    closeSync(fd);
  };
}
