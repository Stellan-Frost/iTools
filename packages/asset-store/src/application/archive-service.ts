/**
 * 归档应用服务：编排仓储完成导出/导入，不触碰网络与日志。
 * 导入必须先完成全部校验；任何写入失败都要回到导入前的状态。
 */
import type {
  AssetArchive,
  AssetRecord,
  AssetReference,
  TaskRecord,
} from '@itools/contracts';

import {
  ArchiveValidationError,
  buildArchive,
  decodeBase64ToBytes,
  parseArchive,
  validateArchiveContent,
} from '../domain/archive-format.js';
import type {
  ArchiveExportOptions,
  ArchiveImportOptions,
  ArchiveImportResult,
  ArchiveService,
  ArchiveServiceOptions,
  AssetRepository,
  StoredAssetInput,
} from './ports.js';

interface ImportEntry {
  readonly record: AssetRecord;
  readonly references: readonly AssetReference[];
  readonly bytes: Uint8Array;
}

interface RepositorySnapshot {
  readonly assets: readonly StoredAssetInput[];
  readonly tasks: readonly TaskRecord[];
}

export function createArchiveService(
  options: ArchiveServiceOptions,
): ArchiveService {
  const { repository } = options;

  return {
    async exportToJson(exportOptions: ArchiveExportOptions): Promise<string> {
      const records = await repository.listAssets();
      const references = await repository.listReferences();
      const tasks = await repository.listTaskRecords();
      const referencesByAsset = groupReferences(references);

      const assets: {
        record: AssetRecord;
        blob: Blob;
        references: readonly AssetReference[];
      }[] = [];
      for (const record of records) {
        const stored = await repository.readAsset(record.assetId);
        if (stored === undefined) continue;
        assets.push({
          record,
          blob: stored.blob,
          references: referencesByAsset.get(record.assetId) ?? [],
        });
      }

      const archive = await buildArchive({
        assets,
        tasks,
        createdAt: options.now().toISOString(),
        includeSourceData: exportOptions.includeSourceData,
      });
      return JSON.stringify(archive);
    },

    async importFromJson(
      json: string,
      importOptions: ArchiveImportOptions,
    ): Promise<ArchiveImportResult> {
      const archive = parseArchive(json);
      const contentIssues = validateArchiveContent(archive);
      if (contentIssues.length > 0) {
        throw new ArchiveValidationError(contentIssues);
      }

      const importableIds = new Set(
        archive.assets
          .filter((entry) => entry.dataBase64 !== undefined)
          .map((entry) => entry.record.assetId),
      );

      const entries: ImportEntry[] = [];
      const metadataOnlyAssetIds: string[] = [];
      for (const entry of archive.assets) {
        if (entry.dataBase64 === undefined) {
          metadataOnlyAssetIds.push(entry.record.assetId);
          continue;
        }
        entries.push({
          record: entry.record,
          // 只保留指向“本次真正恢复”的资产的引用，跳过内容缺失的条目。
          references: entry.references.filter((reference) =>
            importableIds.has(reference.assetId),
          ),
          bytes: decodeBase64ToBytes(entry.dataBase64),
        });
      }

      const importedAssetIds = entries.map((entry) => entry.record.assetId);
      const importedTaskIds = archive.tasks.map((task) => task.taskId);

      if (importOptions.replaceExisting) {
        await importReplacing(repository, archive, entries);
      } else {
        await importMerging(repository, archive, entries);
      }

      return { importedAssetIds, importedTaskIds, metadataOnlyAssetIds };
    },
  };
}

async function importReplacing(
  repository: AssetRepository,
  archive: AssetArchive,
  entries: readonly ImportEntry[],
): Promise<void> {
  const snapshot = await captureSnapshot(repository);
  try {
    await repository.clearAll();
    for (const entry of entries) await writeEntry(repository, entry);
    for (const task of archive.tasks) await repository.writeTaskRecord(task);
  } catch (error) {
    await restoreSnapshot(repository, snapshot);
    throw error;
  }
}

async function importMerging(
  repository: AssetRepository,
  archive: AssetArchive,
  entries: readonly ImportEntry[],
): Promise<void> {
  const snapshot = await captureSnapshot(repository);
  const writtenAssetIds: string[] = [];
  const writtenTaskIds: string[] = [];

  try {
    for (const entry of entries) {
      await writeEntry(repository, entry);
      writtenAssetIds.push(entry.record.assetId);
    }
    for (const task of archive.tasks) {
      await repository.writeTaskRecord(task);
      writtenTaskIds.push(task.taskId);
    }
  } catch (error) {
    await compensateMergeFailure(
      repository,
      snapshot,
      writtenAssetIds,
      writtenTaskIds,
    );
    throw error;
  }
}

async function compensateMergeFailure(
  repository: AssetRepository,
  snapshot: RepositorySnapshot,
  writtenAssetIds: readonly string[],
  writtenTaskIds: readonly string[],
): Promise<void> {
  // 先删除本次新增的资产与其引用；不存在的 ID 视为成功。
  try {
    await repository.deleteAssets(writtenAssetIds);
  } catch {
    // 补偿失败不得掩盖原始写入错误。
  }

  if (writtenTaskIds.length === 0) return;

  // 端口没有单条删除任务的 API：按导入前快照整体恢复，清除新增/被覆盖的任务。
  await restoreSnapshot(repository, snapshot);
}

async function writeEntry(
  repository: AssetRepository,
  entry: ImportEntry,
): Promise<void> {
  const copy = new Uint8Array(entry.bytes.byteLength);
  copy.set(entry.bytes);
  const blob = new Blob([copy.buffer], { type: entry.record.mimeType });
  await repository.writeAsset({
    record: entry.record,
    blob,
    references: entry.references,
  });
}

async function captureSnapshot(
  repository: AssetRepository,
): Promise<RepositorySnapshot> {
  const [records, references, tasks] = await Promise.all([
    repository.listAssets(),
    repository.listReferences(),
    repository.listTaskRecords(),
  ]);
  const referencesByAsset = groupReferences(references);

  const assets: StoredAssetInput[] = [];
  for (const record of records) {
    const stored = await repository.readAsset(record.assetId);
    if (stored === undefined) continue;
    assets.push({
      record,
      blob: stored.blob,
      references: referencesByAsset.get(record.assetId) ?? [],
    });
  }
  return { assets, tasks };
}

/** 尽力恢复快照；恢复过程中的单条失败不会掩盖调用方要抛出的原始错误。 */
async function restoreSnapshot(
  repository: AssetRepository,
  snapshot: RepositorySnapshot,
): Promise<void> {
  try {
    await repository.clearAll();
  } catch {
    return;
  }
  for (const asset of snapshot.assets) {
    try {
      await repository.writeAsset(asset);
    } catch {
      // 继续恢复其余记录。
    }
  }
  for (const task of snapshot.tasks) {
    try {
      await repository.writeTaskRecord(task);
    } catch {
      // 继续恢复其余记录。
    }
  }
}

function groupReferences(
  references: readonly AssetReference[],
): Map<string, AssetReference[]> {
  const grouped = new Map<string, AssetReference[]>();
  for (const reference of references) {
    const list = grouped.get(reference.assetId);
    if (list === undefined) {
      grouped.set(reference.assetId, [reference]);
    } else {
      list.push(reference);
    }
  }
  return grouped;
}
