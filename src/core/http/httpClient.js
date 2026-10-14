// Small HTTP client on Node's built-in fetch, covering what this codebase used from axios:
// get/post/request, `params`, `headers`, `timeout`, `responseType: 'arraybuffer'`, JSON bodies and
// responses, and errors that carry `error.response = { status, data }` for non-2xx replies.

class HttpError extends Error {
    constructor(message, response) {
        super(message);
        this.name = 'HttpError';
        this.response = response;
    }
}

const withParams = (url, params) => {
    if (!params) return url;
    const u = new URL(url);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) u.searchParams.append(key, String(value));
    }
    return u.toString();
};

const toBody = (data, headers) => {
    if (data === undefined || data === null) return undefined;
    if (typeof data === 'string' || data instanceof URLSearchParams || data instanceof FormData || data instanceof Blob || Buffer.isBuffer(data)) {
        return data;
    }
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    return JSON.stringify(data);
};

const parse = async (res, responseType) => {
    if (responseType === 'arraybuffer') return Buffer.from(await res.arrayBuffer());
    const text = await res.text();
    if (!text) return text;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

const request = async ({ method = 'get', url, params, data, headers = {}, timeout, responseType } = {}) => {
    const sendHeaders = { ...headers };
    const res = await fetch(withParams(url, params), {
        method: method.toUpperCase(),
        headers: sendHeaders,
        body: toBody(data, sendHeaders),
        signal: timeout ? AbortSignal.timeout(timeout) : undefined,
    });
    const response = { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers), data: await parse(res, responseType) };
    if (!res.ok) throw new HttpError(`Request failed with status code ${res.status}`, response);
    return response;
};

module.exports = {
    request,
    get: (url, config = {}) => request({ ...config, method: 'get', url }),
    post: (url, data, config = {}) => request({ ...config, method: 'post', url, data }),
    put: (url, data, config = {}) => request({ ...config, method: 'put', url, data }),
    delete: (url, config = {}) => request({ ...config, method: 'delete', url }),
    HttpError,
};
