-- 唯一管理员的凭据：与 src/schema/tables.ts 的 adminCredentials 逐字段等价。
-- 本文件只允许 CREATE 语句；迁移执行器会把整个文件放在单个事务里执行。
-- 单行约束（D05）保证「只有一个管理员」，任何 id <> 1 的写入都会被拒绝。
CREATE TABLE "admin_credentials" (
	"id" integer PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_credentials_single_row" CHECK ("id" = 1)
);
