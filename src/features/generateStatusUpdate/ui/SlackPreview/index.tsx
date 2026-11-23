import { parseSlack } from "../../model/slackText";
import { bubbleStyles, caretStyles, headerStyles, logoStyles, textStyles } from "./styles";
import type { SlackPreviewProps } from "./types";

/** Бульбашка Slack: `*жирний*` → `<strong>` через React-вузли, решта екранується; текст у `aria-live="polite"`. */
export const SlackPreview = ({ text, typing }: SlackPreviewProps) => (
  <div className={bubbleStyles}>
    <span className={logoStyles} aria-hidden="true">dl</span>
    <div className="min-w-0">
      <p className={headerStyles}>
        <strong className="text-fg-strong">DevLog</strong>
        <span>#platform-team</span>
        <span>чернетка</span>
      </p>
      <div className={textStyles} aria-live="polite" data-testid="slack-preview-text">
        {parseSlack(text).map((line, lineIndex) => (
          <span key={lineIndex} className="block">
            {line.map((segment, index) => (segment.bold
              ? <strong key={index} className="font-semibold text-fg-strong">{segment.text}</strong>
              : <span key={index}>{segment.text}</span>))}
          </span>
        ))}
        {typing ? <span className={caretStyles} aria-hidden="true" /> : null}
      </div>
    </div>
  </div>
);
