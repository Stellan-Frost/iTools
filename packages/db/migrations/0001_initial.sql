-- 初始结构：与 src/schema/tables.ts 逐字段等价（类型、可空性、默认值、级联、索引名）。
-- 本文件只允许 CREATE 语句；迁移执行器会把整个文件放在单个事务里执行。
CREATE TABLE "tools" (
	"tool_id" text PRIMARY KEY NOT NULL,
	"display_order" integer,
	"availability_override" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_localizations" (
	"tool_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text,
	"summary" text,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tool_localizations_tool_id_locale_pk" PRIMARY KEY("tool_id","locale")
);
--> statement-breakpoint
CREATE TABLE "tool_metadata_versions" (
	"version_id" bigserial PRIMARY KEY NOT NULL,
	"tool_id" text NOT NULL,
	"locale" text,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "tool_localizations_locale_idx" ON "tool_localizations" USING btree ("locale");
--> statement-breakpoint
CREATE INDEX "tool_metadata_versions_tool_idx" ON "tool_metadata_versions" USING btree ("tool_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_idx" ON "admin_sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "tool_localizations" ADD CONSTRAINT "tool_localizations_tool_id_tools_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "tools"("tool_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tool_metadata_versions" ADD CONSTRAINT "tool_metadata_versions_tool_id_tools_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "tools"("tool_id") ON DELETE cascade ON UPDATE no action;
