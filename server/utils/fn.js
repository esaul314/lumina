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
 * 🔤 toLower
 * Safe string lowercase mapper.
 */
const toLower = (str) => (str || '').toLowerCase();

/**
 * 📍 includes
 * Curried substring matcher.
 */
const includes = curry((substring, str) => (str || '').includes(substring));

module.exports = {
  curry,
  pipe,
  prop,
  map,
  filter,
  reduce,
  toLower,
  includes
};
