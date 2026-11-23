CREATE TABLE `agent_quotas` (
	`kind` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "agent_quotas_kind_check" CHECK("agent_quotas"."kind" in ('prioritize', 'decompose', 'status-update', 'stuck-radar', 'voice-draft')),
	CONSTRAINT "agent_quotas_used_check" CHECK("agent_quotas"."used" >= 0)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `search_text` text;
