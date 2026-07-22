// @ts-check

/**
 * Reduce an async collection from left to right.
 *
 * The promise accumulator is the Chain boundary: each step receives the
 * completed accumulator, so effects remain ordered without a mutable loop.
 *
 * @template T, A
 * @param {(accumulator: A, value: T, index: number) => A | Promise<A>} step
 * @param {A} initial
 * @returns {(values?: T[]) => Promise<A>}
 */
const reduceAsyncSequentially = (step, initial) => (values = []) => values.reduce(
  (promise, value, index) => promise.then((accumulator) => step(accumulator, value, index)),
  Promise.resolve(initial)
);

module.exports = {
  reduceAsyncSequentially
};
