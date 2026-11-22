import type { Note } from "@/entities/task";

export type NoteListProps = {
  notes: Note[];
  now: number;
  taskId: string;
};
