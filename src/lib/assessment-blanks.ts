/** Replace the first explicit answer blank with the chosen SAT option. */
export function fillQuestionBlank(
  html: string,
  options?: Record<string, string> | null,
  selected?: string | null,
) {
  if (!selected || !options?.[selected]) return html;
  const optionHtml = options[selected]
    .replace(/^\s*<p\b[^>]*>/i, "")
    .replace(/<\/p>\s*$/i, "");
  const choice = `<span class="assessment-answer-in-blank">${optionHtml}</span>`;
  const patterns = [
    /<span\b[^>]*aria-hidden=["']true["'][^>]*>\s*(?:_{2,}|&nbsp;|&#160;|\s)*<\/span>\s*<span\b[^>]*class=["'][^"']*\bsr-only\b[^"']*["'][^>]*>\s*blank\s*<\/span>/i,
    /_{3,}/,
    /<u\b[^>]*>\s*(?:&nbsp;|&#160;|\s)*<\/u>/i,
    /\[(?:blank|select|choose)\]/i,
    /\[(?:\.{3,}|…|_{2,})\]/,
    /<span\b([^>]*(?:blank|fill-in)[^>]*)>\s*<\/span>/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(html)) return html.replace(pattern, choice);
  }
  return html;
}
