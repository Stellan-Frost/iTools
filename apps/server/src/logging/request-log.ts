import type { onResponseHookHandler } from 'fastify';

/**
 * 最小化请求日志。
 *
 * 只记录运行状态所需字段：时间、请求 ID、方法、路径、状态码与耗时。
 * 不读取请求头（含 cookie/authorization）、请求体、响应体或处理结果，
 * 路径中的查询串一律丢弃，避免凭据与敏感参数进入日志。
 */
export interface RequestLogEntry {
  /** 记录时刻，ISO 8601。 */
  readonly time: string;
  readonly requestId: string;
  readonly method: string;
  /** 仅路径，不含查询串。 */
  readonly path: string;
  readonly status: number;
  readonly durationMs: number;
}

export interface RequestLoggerOptions {
  /** 输出目标；生产写 stdout，测试注入收集器。 */
  readonly write: (line: string) => void;
  readonly now: () => Date;
  /** 可选：高于该耗时才记录（毫秒），缺省 0 表示全部记录。 */
  readonly slowThresholdMs?: number;
}

/** 去掉 `request.url` 中 `?` 之后的查询串。 */
function extractPath(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

/** 固定键顺序的单行 JSON。 */
export function formatRequestLog(entry: RequestLogEntry): string {
  return JSON.stringify({
    time: entry.time,
    requestId: entry.requestId,
    method: entry.method,
    path: entry.path,
    status: entry.status,
    durationMs: entry.durationMs,
  });
}

export function createRequestLogger(
  options: RequestLoggerOptions,
): onResponseHookHandler {
  const slowThresholdMs = options.slowThresholdMs ?? 0;

  return (request, reply, done) => {
    try {
      const durationMs = Math.round(reply.elapsedTime);
      if (durationMs < slowThresholdMs) {
        done();
        return;
      }

      const entry: RequestLogEntry = {
        time: options.now().toISOString(),
        requestId: request.id,
        method: request.method,
        path: extractPath(request.url),
        status: reply.statusCode,
        durationMs,
      };

      // write 失败（含管道关闭）不得影响请求，也不再重试写日志。
      options.write(formatRequestLog(entry));
    } catch {
      // 日志失败静默忽略，保证响应结果不受影响。
    }
    done();
  };
}
