/**
 * Tells Harbor's own search text apart from text the native field typed.
 *
 * Every keystroke in the native field becomes Harbor's query, and the query
 * is mirrored back to the field. The mirror runs later than the keystroke, so
 * with fast typing it can see an older text than the field now holds; sent
 * back, that would overwrite what the user has typed since. Texts the field
 * reported are therefore never sent back to it.
 */
export class NativeTextEcho {
  private reportedTexts: string[] = [];
  private lastSent: string | null = null;

  /** The native field says it now holds `text`. */
  reported(text: string): void {
    this.reportedTexts.push(text);
    if (this.reportedTexts.length > 64) this.reportedTexts.shift();
    this.lastSent = null;
  }

  /** Whether Harbor's query `text` is news to the native field. */
  shouldSend(text: string): boolean {
    const at = this.reportedTexts.indexOf(text);
    if (at >= 0) {
      this.reportedTexts.splice(0, at + 1);
      return false;
    }
    if (text === this.lastSent) return false;
    this.reportedTexts = [];
    this.lastSent = text;
    return true;
  }
}
