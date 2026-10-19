import Type, { type Static } from 'typebox';
import Value from 'typebox/value';

// 服务端在启动阶段验证该 Schema；数据库口令不得写入错误日志。
export const ServerEnvironmentSchema = Type.Object(
  {
    NODE_ENV: Type.Union([
      Type.Literal('development'),
      Type.Literal('test'),
      Type.Literal('production'),
    ]),
    HOST: Type.String({ minLength: 1 }),
    PORT: Type.Integer({ minimum: 1, maximum: 65535 }),
    DATABASE_URL: Type.String({ pattern: '^postgres(?:ql)?://' }),
  },
  { additionalProperties: true },
);

export type ServerEnvironment = Static<typeof ServerEnvironmentSchema>;

export function parseServerEnvironment(
  raw: Record<string, string | undefined>,
): ServerEnvironment {
  const environment = {
    NODE_ENV: raw.NODE_ENV,
    HOST: raw.HOST,
    PORT: Number(raw.PORT),
    DATABASE_URL: raw.DATABASE_URL,
  };

  if (!Value.Check(ServerEnvironmentSchema, environment)) {
    // 错误不回显变量值，以免数据库连接串进入日志。
    throw new Error('Invalid server environment configuration');
  }

  return environment;
}
