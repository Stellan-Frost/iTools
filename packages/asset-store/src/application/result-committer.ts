/**
 * 任务结果提交通道：把运行时的输出转换成一组结果资产。
 * 返回函数与 @itools/task-runtime 的 commitResult 结构兼容，但不依赖该包，
 * 避免应用层之间产生反向依赖。
 */
import type { AssetService } from './ports.js';

export interface ResultArtifact {
  readonly name: string;
  readonly mimeType: string;
  readonly blob: Blob;
}

export interface ResultCommitterOptions {
  readonly service: AssetService;
  readonly resolveArtifacts: (output: unknown) => readonly ResultArtifact[];
}

export function createAssetResultCommitter(
  options: ResultCommitterOptions,
): (taskId: string, output: unknown) => Promise<readonly string[]> {
  return async (
    taskId: string,
    output: unknown,
  ): Promise<readonly string[]> => {
    // resolveArtifacts 抛错直接冒泡：任务运行时据此把任务标记为失败。
    const artifacts = options.resolveArtifacts(output);
    const assetIds: string[] = [];
    for (const artifact of artifacts) {
      // 任一写入失败都会中断并冒泡，绝不返回“部分成功”的 ID 列表。
      const record = await options.service.createResult({
        ...artifact,
        taskId,
      });
      assetIds.push(record.assetId);
    }
    return assetIds;
  };
}
