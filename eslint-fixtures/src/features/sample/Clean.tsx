import { SAMPLE_ENTITY } from "../../entities/sample";

const SAMPLE_STATUSES = ["todo", "done"] as const;

export const SampleBadge = () => {
  return <span>{SAMPLE_ENTITY}{SAMPLE_STATUSES[0]}</span>;
};
