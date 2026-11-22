import { AddNoteForm } from "@/features/noteAdd";
import { ageLabel } from "@/shared/lib/ageLabel";
import { EmptyState } from "@/shared/ui/EmptyState";
import { dateStyles, listStyles, noteStyles, sectionStyles, textStyles } from "./styles";
import type { NoteListProps } from "./types";

const noteAge = (createdAt: string, now: number) => {
  const age = ageLabel(createdAt, now);
  return age === "сьогодні" ? age : `${age} тому`;
};

export const NoteList = ({ notes, now, taskId }: NoteListProps) => (
  <section aria-labelledby="notes-title" className={sectionStyles}>
    <h2 id="notes-title" className="font-medium text-fg-strong">Нотатки про виконання</h2>
    {notes.length === 0 ? (
      <EmptyState emoji="📝" title="Нотаток немає"
        description="Агент статус-апдейту пише точніше, коли вони є." />
    ) : (
      <ul className={listStyles}>
        {notes.map((note) => (
          <li key={note.id} className={noteStyles}>
            <p className={textStyles}>{note.text}</p>
            <p className={dateStyles}>{noteAge(note.createdAt, now)}</p>
          </li>
        ))}
      </ul>
    )}
    <AddNoteForm taskId={taskId} />
  </section>
);
