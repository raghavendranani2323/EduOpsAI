import { randomUUID } from "node:crypto";

const REQUEST_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/;

export function requestIdFrom(request?: Request) {
  const supplied = request?.headers.get("x-request-id")?.trim();
  return supplied && REQUEST_ID_RE.test(supplied) ? supplied : randomUUID();
}
