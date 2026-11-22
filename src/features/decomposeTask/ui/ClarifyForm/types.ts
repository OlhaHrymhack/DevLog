export type ClarifyFormProps = {
  questions: readonly string[];
  /** Серйозний режим: без емодзі. */
  serious: boolean;
  pending: boolean;
  onSubmit: (answer: string) => void;
  onCancel: () => void;
};
