/**
 * The question typed on the blank-slate screen, handed to the conversation
 * screen that the create then navigates to.
 *
 * A module-level map rather than a URL param or storage: the handoff only has to
 * survive one client-side navigation in the same tab. A query string would put
 * the whole question in the address bar and in history; `sessionStorage` would
 * leave a key behind for every conversation ever started.
 *
 * Reading takes the value, so a reload of the conversation URL does not re-ask
 * the question.
 */
const pending = new Map<string, string>();

export function setPendingQuestion(conversationId: string, question: string) {
  pending.set(conversationId, question);
}

export function takePendingQuestion(conversationId: string): string | undefined {
  const question = pending.get(conversationId);
  pending.delete(conversationId);
  return question;
}
