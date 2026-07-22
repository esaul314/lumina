// @ts-check

function createRouteFailure(status, error, extra = {}) {
  return { status, error, extra };
}

function createRouteDecodeSuccess(value) {
  return { routeDecode: true, ok: true, value };
}

function createRouteDecodeFailure(status, error, extra = {}) {
  return {
    routeDecode: true,
    ok: false,
    failure: createRouteFailure(status, error, extra)
  };
}

function normalizeRouteDecodeResult(decoded) {
  return decoded?.routeDecode ? decoded : createRouteDecodeSuccess(decoded);
}

const mapRouteDecode = (transform) => (decoded) => {
  const result = normalizeRouteDecodeResult(decoded);
  return result.ok ? createRouteDecodeSuccess(transform(result.value)) : result;
};

const chainRouteDecode = (transform) => (decoded) => {
  const result = normalizeRouteDecodeResult(decoded);
  return result.ok ? normalizeRouteDecodeResult(transform(result.value)) : result;
};

const collectRouteDecodeResults = (results = []) => results.reduce(
  (collected, result) => {
    if (!collected.ok) {
      return collected;
    }

    const normalized = normalizeRouteDecodeResult(result);
    return normalized.ok
      ? createRouteDecodeSuccess([...collected.value, normalized.value])
      : normalized;
  },
  createRouteDecodeSuccess([])
);

module.exports = {
  chainRouteDecode,
  collectRouteDecodeResults,
  createRouteDecodeFailure,
  createRouteDecodeSuccess,
  createRouteFailure,
  mapRouteDecode,
  normalizeRouteDecodeResult
};
