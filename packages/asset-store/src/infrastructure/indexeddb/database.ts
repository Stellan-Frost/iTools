/**
 * IndexedDB 的打开与版本迁移。
 *
 * 迁移策略：`MIGRATIONS` 以目标版本号为键，升级时从 `oldVersion + 1` 逐版本执行到
 * `newVersion`。每个步骤只在 `versionchange` 事务内做增量变更，绝不删除对象仓库、
 * 索引或已有记录；缺失迁移步骤视为编程错误，直接中止升级并让 `open` 失败。
 */

export const ASSET_DATABASE_NAME = 'itools-assets';
export const ASSET_DATABASE_VERSION = 1;

export interface OpenAssetDatabaseOptions {
  readonly factory: IDBFactory;
  readonly name?: string;
  readonly version?: number;
}

/** 单步迁移：只允许建仓库/索引，不得删数据。 */
export type AssetDatabaseMigration = (
  db: IDBDatabase,
  tx: IDBTransaction,
) => void;

/**
 * 升级期间等待其他连接关闭的最长时间；超时后按失败处理，避免 UI 永久悬挂。
 * 该常量仅用于内部超时判定，不参与调用方契约。
 */
const OPEN_TIMEOUT_MS = 15_000;

/**
 * 版本迁移表。新增版本时追加一个键，历史步骤保持不变，因为老用户可能从任意
 * 旧版本直接升级到最新版本。
 */
const MIGRATIONS: Readonly<Record<number, AssetDatabaseMigration>> = {
  1: (db) => {
    const assets = db.createObjectStore('assets', { keyPath: 'assetId' });
    // 非唯一索引；缺少 taskId 的记录不会被索引，正是期望的“允许空值跳过”。
    assets.createIndex('by-task', 'taskId', { unique: false });
    assets.createIndex('by-created', 'createdAt', { unique: false });

    db.createObjectStore('blobs', { keyPath: 'assetId' });

    const references = db.createObjectStore('references', {
      keyPath: ['assetId', 'taskId'],
    });
    references.createIndex('by-asset', 'assetId', { unique: false });
    references.createIndex('by-task', 'taskId', { unique: false });

    db.createObjectStore('tasks', { keyPath: 'taskId' });
    db.createObjectStore('meta', { keyPath: 'key' });
  },
};

function toError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

/**
 * 打开数据库并按需升级。失败（包含迁移异常、版本冲突与被阻塞）一律 reject，
 * 不返回半成品连接。
 */
export function openAssetDatabase(
  options: OpenAssetDatabaseOptions,
): Promise<IDBDatabase> {
  const name = options.name ?? ASSET_DATABASE_NAME;
  const version = options.version ?? ASSET_DATABASE_VERSION;

  return new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = options.factory.open(name, version);
    } catch (error) {
      reject(toError(error, `无法打开数据库：${name}`));
      return;
    }

    let settled = false;
    let migrationError: Error | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearWatchdog = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearWatchdog();
      reject(error);
    };

    timer = setTimeout(() => {
      fail(new Error(`打开数据库超时：${name}`));
    }, OPEN_TIMEOUT_MS);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      const targetVersion = event.newVersion ?? version;

      if (transaction === null) {
        // 理论上不会发生；缺少事务时无法保证原子升级。
        migrationError = new Error(`数据库升级缺少事务：${name}`);
        fail(migrationError);
        return;
      }

      try {
        for (
          let nextVersion = event.oldVersion + 1;
          nextVersion <= targetVersion;
          nextVersion += 1
        ) {
          const migrate = MIGRATIONS[nextVersion];
          if (migrate === undefined) {
            throw new Error(`缺少数据库迁移步骤：版本 ${nextVersion}`);
          }
          migrate(db, transaction);
        }
      } catch (error) {
        migrationError = toError(error, `数据库迁移失败：${name}`);
        try {
          // 中止升级事务，让 IndexedDB 回滚本次结构性变更。
          transaction.abort();
        } catch {
          // 事务可能已因其他错误中止，保留原始错误即可。
        }
        fail(migrationError);
      }
    };

    request.onblocked = () => {
      // 其他标签页仍持有旧连接。立即失败可让调用方提示用户关闭旧页面，
      // 而不是无限等待；迟到的成功连接会在 onsuccess 中关闭。
      fail(new Error(`数据库升级被其他页面阻塞：${name}`));
    };

    request.onerror = () => {
      const failure = migrationError ?? request.error;
      fail(
        toError(
          failure,
          `数据库打开失败：${name}（${failure?.name ?? '未知错误'}）`,
        ),
      );
    };

    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        // 已被判定为阻塞/失败，迟到的连接立刻关闭，避免泄漏与后续阻塞。
        db.close();
        return;
      }
      settled = true;
      clearWatchdog();
      resolve(db);
    };
  });
}
