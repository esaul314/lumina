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

function collectRouteDecodeResults(results = []) {
  const values = [];

  for (const result of results) {
    const normalized = normalizeRouteDecodeResult(result);
    if (!normalized.ok) {
      return normalized;
    }

    values.push(normalized.value);
  }

  return createRouteDecodeSuccess(values);
}

module.exports = {
  chainRouteDecode,
  collectRouteDecodeResults,
  createRouteDecodeFailure,
  createRouteDecodeSuccess,
  createRouteFailure,
  mapRouteDecode,
  normalizeRouteDecodeResult
};
