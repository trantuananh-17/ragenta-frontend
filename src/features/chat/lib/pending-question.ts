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
export interface PendingQuestion {
  content: string;
  /** A model chosen on the blank slate applies to the turn it was chosen for. */
  model: { provider: string; model: string } | null;
}

const pending = new Map<string, PendingQuestion>();

export function setPendingQuestion(
  conversationId: string,
  question: PendingQuestion,
) {
  pending.set(conversationId, question);
}

/**
 * Reads without consuming.
 *
 * For state that has to hold the pending model from the very first render — the
 * composer's model chip — rather than being assigned from inside the effect that
 * sends the question. Setting state in an effect body is a cascading render and
 * the lint rule that says so is right: the value is known before the component
 * ever paints.
 */
export function peekPendingQuestion(
  conversationId: string,
): PendingQuestion | undefined {
  return pending.get(conversationId);
}

export function takePendingQuestion(
  conversationId: string,
): PendingQuestion | undefined {
  const question = pending.get(conversationId);
  pending.delete(conversationId);
  return question;
}
