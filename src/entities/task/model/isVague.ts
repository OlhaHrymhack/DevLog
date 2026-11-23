/** Розмиті слова, за якими опис вважається нечітким (прототип `isVague`). */
const VAGUE_WORDS = /щось|якось|покращити|розібратись|погані/i;
export const MIN_CLEAR_DESCRIPTION_LENGTH = 40;

type VagueInput = { title: string; description: string };

/** Причини, чому задача нечітка; порожній масив — формулювання чітке. */
export const clarityReasons = ({ title, description }: VagueInput): string[] => {
  const reasons: string[] = [];
  if (description.trim().length < MIN_CLEAR_DESCRIPTION_LENGTH) {
    reasons.push(`Опис коротший за ${MIN_CLEAR_DESCRIPTION_LENGTH} символів`);
  }
  const vague = VAGUE_WORDS.exec(`${title} ${description}`);
  if (vague) reasons.push(`У тексті є розмите слово «${vague[0].toLowerCase()}»`);
  return reasons;
};

export const isVague = (task: VagueInput): boolean => clarityReasons(task).length > 0;
