/**
 * 🌌 Lumina Functional Programming Primitives
 * ------------------------------------------
 * A zero-dependency, high-performance module providing currying,
 * partial execution, and function composition.
 */

/**
 * 🌀 curry
 * Auto-curries a function to support flexible partial execution.
 */
const curry = (fn) => {
  const curried = (...args) => {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs) => curried(...args, ...nextArgs);
  };
  return curried;
};

/**
 * 🚰 pipe
 * Composes a list of functions from left to right (pipeline flow).
 */
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

/**
 * 🔍 prop
 * Curried property extractor.
 */
const prop = curry((key, obj) => (obj ? obj[key] : undefined));

/**
 * 🗺️ map
 * Curried version of standard Array.prototype.map.
 */
const map = curry((fn, arr) => (arr ? arr.map(fn) : []));

/**
 * 🛡️ filter
 * Curried version of standard Array.prototype.filter.
 */
const filter = curry((fn, arr) => (arr ? arr.filter(fn) : []));

/**
 * 📥 reduce
 * Curried version of standard Array.prototype.reduce.
 */
const reduce = curry((fn, initial, arr) => (arr ? arr.reduce(fn, initial) : initial));

/**
 * Build a keyed interpreter from declarative entries.
 *
 * Map keeps the accepted key space closed, so inherited object properties
 * cannot accidentally become commands. Duplicate keys retain normal Map
 * semantics: the last declarative entry wins.
 *
 * @template K, E, R
 * @param {Array<[K, E]>} entries
 * @param {(entry: E, ...args: any[]) => R} interpret
 * @param {(...args: any[]) => R} fallback
 * @returns {(key: K, ...args: any[]) => R}
 */
const createIndexedInterpreter = (entries, interpret, fallback) => {
  const index = new Map(entries);

  return (key, ...args) => {
    const entry = index.get(key);
    return entry === undefined
      ? fallback(...args)
      : interpret(entry, ...args);
  };
};

/**
 * Build a closed interpreter directly from a handler record.
 *
 * The record is converted once to the indexed interpreter above, so callers
 * can expose a small declared vocabulary without opening prototype properties
 * as accidental handlers.
 *
 * @template E, R
 * @param {Record<string, E>} handlers
 * @param {(entry: E, ...args: any[]) => R} [interpret]
 * @param {(...args: any[]) => R} [fallback]
 * @returns {(key: string, ...args: any[]) => R}
 */
const createClosedInterpreter = (
  handlers,
  interpret = (handler) => handler,
  fallback = () => undefined
) => createIndexedInterpreter(Object.entries(handlers), interpret, fallback);

/**
 * 🔤 toLower
 * Safe string lowercase mapper.
 */
const toLower = (str) => (str || '').toLowerCase();

/**
 * 📍 includes
 * Curried substring matcher.
 */
const includes = curry((substring, str) => (str || '').includes(substring));

/**
 * 🔍 uniqBy
 * Curried utility that filters a list to keep only unique elements determined by keyFn.
 */
const uniqBy = curry((keyFn, arr) => {
  const seen = new Set();
  return filter(item => {
    const val = keyFn(item);
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  }, arr);
});

module.exports = {
  curry,
  pipe,
  prop,
  map,
  filter,
  reduce,
  createIndexedInterpreter,
  createClosedInterpreter,
  toLower,
  includes,
  uniqBy
};
