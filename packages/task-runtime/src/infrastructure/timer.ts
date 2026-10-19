/**
 * 定时器接缝：运行时包不假设自己跑在浏览器还是 Node 里。
 * 真实环境由调用方注入 globalThis 上的 setTimeout/clearTimeout。
 */
export interface TimerApi {
  set(delayMs: number, callback: () => void): unknown;
  clear(handle: unknown): void;
}
