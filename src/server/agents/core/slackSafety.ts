/** Масові згадки й службова Slack-розмітка, яку агент не має пропускати в чернетку. */
export const BROADCAST = /@(?:channel|here|everyone)\b|<!(?:channel|here|everyone)|<@[A-Z0-9]+>|<mailto:/i;

const BROADCAST_WORD = /@(channel|here|everyone)\b/gi;

/** Прибирає масові згадки з даних задачі (назва, нотатки) перед вставкою в чернетку. */
export const neutralizeMentions = (text: string): string => text.replace(BROADCAST_WORD, "$1").replace(/<[!@]/g, "<");
