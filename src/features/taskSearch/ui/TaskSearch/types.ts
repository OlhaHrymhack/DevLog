import type { Ref } from "react";

export type TaskSearchProps = {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
};
