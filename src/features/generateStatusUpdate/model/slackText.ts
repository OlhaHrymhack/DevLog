export type SlackSegment = { text: string; bold: boolean };

const BOLD = /\*([^*\n]+)\*/g;

/** Slack-розмітка → сегменти: `*жирний*` стає `bold`, усе інше — звичайний текст. Без HTML: екранує React. */
export const parseSlackLine = (line: string): SlackSegment[] => {
  const segments: SlackSegment[] = [];
  let last = 0;
  for (const match of line.matchAll(BOLD)) {
    if (match.index > last) segments.push({ text: line.slice(last, match.index), bold: false });
    segments.push({ text: match[1] ?? "", bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) segments.push({ text: line.slice(last), bold: false });
  return segments;
};

export const parseSlack = (text: string): SlackSegment[][] => text.split("\n").map(parseSlackLine);
