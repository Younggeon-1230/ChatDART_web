const UPSTREAM_ORIGIN =
  process.env.UPSTREAM_API_ORIGIN?.trim() || "http://localhost:8000";

type ProxyRouteContext = {
  params: Promise<{ path: string[] }>;
};

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);
const REQUEST_HEADERS_TO_REMOVE = [
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "connection",
  "content-length",
  "host",
];

async function proxyRequest(request: Request, context: ProxyRouteContext) {
  const { path } = await context.params;
  const requestUrl = new URL(request.url);
  const upstreamPath =
    path.length === 1 && path[0] === "_health"
      ? "/health"
      : `/api/${path.map(encodeURIComponent).join("/")}`;
  const upstreamUrl = new URL(upstreamPath, UPSTREAM_ORIGIN);
  upstreamUrl.search = requestUrl.search;

  const headers = new Headers(request.headers);
  REQUEST_HEADERS_TO_REMOVE.forEach((header) => headers.delete(header));

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: METHODS_WITHOUT_BODY.has(request.method) ? undefined : request.body,
    redirect: "manual",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}

export const GET = proxyRequest;
export const HEAD = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
