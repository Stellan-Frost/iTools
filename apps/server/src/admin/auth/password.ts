/**
 * 管理员口令哈希：scrypt（N=16384, r=8, p=1）。
 * 存储格式自带算法与参数，便于未来升级；校验失败一律返回 false，不抛错。
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'scrypt';
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;

const PARAMS = `N=${COST},r=${BLOCK_SIZE},p=${PARALLELIZATION}`;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

interface ParsedHash {
  readonly salt: Buffer;
  readonly hash: Buffer;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derive(password, salt, KEY_BYTES);

  return [
    ALGORITHM,
    PARAMS,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * 任何解析失败、参数不符或长度异常都视为校验失败。
 * 只有格式完全匹配才进入 KDF，避免被畸形字符串拖入高成本计算。
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (parsed === undefined) {
    return false;
  }

  try {
    const derived = await derive(password, parsed.salt, parsed.hash.length);
    return (
      derived.length === parsed.hash.length &&
      timingSafeEqual(derived, parsed.hash)
    );
  } catch {
    return false;
  }
}

function parseStoredHash(stored: string): ParsedHash | undefined {
  const parts = stored.split('$');
  if (parts.length !== 4) {
    return undefined;
  }

  const [algorithm, params, saltText, hashText] = parts;
  if (algorithm !== ALGORITHM || params !== PARAMS) {
    return undefined;
  }
  if (saltText === undefined || hashText === undefined) {
    return undefined;
  }
  if (!BASE64_PATTERN.test(saltText) || !BASE64_PATTERN.test(hashText)) {
    return undefined;
  }

  const salt = Buffer.from(saltText, 'base64');
  const hash = Buffer.from(hashText, 'base64');
  if (salt.length !== SALT_BYTES || hash.length !== KEY_BYTES) {
    return undefined;
  }
  // 重新编码比对，拒绝 Buffer 宽松解码可接受的畸形 base64。
  if (
    salt.toString('base64') !== saltText ||
    hash.toString('base64') !== hashText
  ) {
    return undefined;
  }

  return { salt, hash };
}

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: MAX_MEMORY_BYTES,
      },
      (error, derivedKey) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}
