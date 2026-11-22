CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`task_id` text,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`result_json` text,
	`error_json` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "agent_runs_kind_check" CHECK("agent_runs"."kind" in ('prioritize', 'decompose', 'status-update', 'stuck-radar')),
	CONSTRAINT "agent_runs_status_check" CHECK("agent_runs"."status" in ('running', 'result', 'clarify', 'fallback', 'stopped', 'error')),
	CONSTRAINT "agent_runs_mode_check" CHECK("agent_runs"."mode" in ('live', 'demo'))
);
--> statement-breakpoint
CREATE TABLE `agent_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`index` integer NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`state` text NOT NULL,
	`detail` text,
	`payload_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "agent_steps_type_check" CHECK("agent_steps"."type" in ('model', 'tool', 'validation')),
	CONSTRAINT "agent_steps_state_check" CHECK("agent_steps"."state" in ('done', 'fail'))
);
--> statement-breakpoint
CREATE INDEX `agent_steps_run_id_idx` ON `agent_steps` (`run_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_task_id_idx` ON `notes` (`task_id`);--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`estimate` text,
	`rationale` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "subtasks_status_check" CHECK("subtasks"."status" in ('todo', 'in-progress', 'done')),
	CONSTRAINT "subtasks_source_check" CHECK("subtasks"."source" in ('user', 'ai'))
);
--> statement-breakpoint
CREATE INDEX `subtasks_task_id_idx` ON `subtasks` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`due_at` text,
	`focus_rank` integer,
	CONSTRAINT "tasks_status_check" CHECK("tasks"."status" in ('todo', 'in-progress', 'done')),
	CONSTRAINT "tasks_priority_check" CHECK("tasks"."priority" in ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);