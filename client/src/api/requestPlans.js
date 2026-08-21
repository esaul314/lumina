// @ts-check

/**
 * @typedef {'POST'} MutationMethod
 * @typedef {{
 *   path: string,
 *   method: MutationMethod,
 *   body: unknown,
 *   legacy: { event: string, payload: unknown }
 * }} MutationPlan
 */

const identity = (value) => value;

/**
 * Describe a REST-first mutation and its temporary legacy transport shape.
 *
 * The projection is deliberately pure: request execution and socket fallback
 * stay in the API module's imperative shell.
 *
 * @template Input
 * @param {{
 *   path: string,
 *   event: string,
 *   body?: (input: Input) => unknown,
 *   legacy?: (input: Input) => unknown
 * }} spec
 * @returns {(input: Input) => MutationPlan}
 */
export const buildMutationPlan = ({
  path,
  event,
  body = identity,
  legacy = identity
}) => (input) => ({
  path,
  method: 'POST',
  body: body(input),
  legacy: {
    event,
    payload: legacy(input)
  }
});
