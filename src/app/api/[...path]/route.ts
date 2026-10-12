type ProxyRouteContext = {
  params: Promise<{ path: string[] }>;
};

type AllowedRoute = {
  methods: readonly string[];
  matches: (path: readonly string[]) => boolean;
};

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];
const REQUEST_HEADERS_TO_REMOVE = [
  ...HOP_BY_HOP_HEADERS,
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "content-length",
  "host",
];

function exactPath(expected: readonly string[]) {
  return (path: readonly string[]) =>
    path.length === expected.length &&
    expected.every((segment, index) => path[index] === segment);
}

function pathWithFinalSegment(
  prefix: readonly string[],
  isValidFinalSegment: (segment: string) => boolean,
) {
  return (path: readonly string[]) =>
    path.length === prefix.length + 1 &&
    prefix.every((segment, index) => path[index] === segment) &&
    isValidFinalSegment(path[path.length - 1]);
}

const ALLOWED_ROUTES: readonly AllowedRoute[] = [
  { methods: ["GET"], matches: exactPath(["_health"]) },
  {
    methods: ["POST"],
    matches: (path) =>
      ["login", "register", "refresh", "logout"].some((action) =>
        exactPath(["v1", "auth", action])(path),
      ),
  },
  { methods: ["GET"], matches: exactPath(["v1", "membership", "plans"]) },
  { methods: ["GET"], matches: exactPath(["v1", "membership", "me"]) },
  {
    methods: ["GET"],
    matches: exactPath(["v1", "users", "me", "watchlist", "summaries"]),
  },
  {
    methods: ["POST"],
    matches: exactPath(["v1", "users", "me", "watchlist"]),
  },
  {
    methods: ["PATCH", "DELETE"],
    matches: pathWithFinalSegment(
      ["v1", "users", "me", "watchlist"],
      (stockCode) => /^\d{6}$/.test(stockCode),
    ),
  },
  {
    methods: ["GET"],
    matches: exactPath(["v1", "users", "me", "dashboard"]),
  },
  { methods: ["POST"], matches: exactPath(["v1", "finance", "collect"]) },
  {
    methods: ["GET"],
    matches: exactPath(["v1", "finance", "collect", "status"]),
  },
  { methods: ["GET"], matches: exactPath(["v1", "finance", "summary"]) },
  {
    methods: ["GET"],
    matches: exactPath(["v1", "finance", "summary", "detail"]),
  },
  {
    methods: ["GET"],
    matches: exactPath(["v1", "finance", "summary", "ai-analysis"]),
  },
  {
    methods: ["POST"],
    matches: exactPath(["v1", "finance", "insights", "interpret"]),
  },
  {
    methods: ["GET"],
    matches: exactPath(["v1", "finance", "disclosures"]),
  },
  {
    methods: ["POST"],
    matches: exactPath(["v1", "finance", "compare", "save"]),
  },
  {
    methods: ["GET"],
    matches: pathWithFinalSegment(
      ["v1", "finance", "compare"],
      (shareId) => /^[0-9a-fA-F]{8,16}$/.test(shareId),
    ),
  },
  { methods: ["GET"], matches: exactPath(["v1", "finance", "similar"]) },
  {
    methods: ["GET"],
    matches: exactPath(["v1", "finance", "recommendation"]),
  },
  { methods: ["GET"], matches: exactPath(["v1", "finance", "search"]) },
];

function getUpstreamOrigin() {
  const configuredOrigin = process.env.UPSTREAM_API_ORIGIN?.trim();

  if (!configuredOrigin) {
    return null;
  }

  try {
    const upstreamOrigin = new URL(configuredOrigin);

    if (
      upstreamOrigin.protocol !== "https:" ||
      upstreamOrigin.username ||
      upstreamOrigin.password
    ) {
      return null;
    }

    return upstreamOrigin.origin;
  } catch {
    return null;
  }
}

function isSafePath(path: readonly string[]) {
  return (
    path.length > 0 &&
    path.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("%") &&
        !segment.includes("/") &&
        !segment.includes("\\") &&
        !segment.includes("\0"),
    )
  );
}

function getRouteStatus(method: string, path: readonly string[]) {
  if (!isSafePath(path)) {
    return "blocked" as const;
  }

  const matchingRoutes = ALLOWED_ROUTES.filter((route) => route.matches(path));

  if (matchingRoutes.length === 0) {
    return "blocked" as const;
  }

  return matchingRoutes.some((route) => route.methods.includes(method))
    ? ("allowed" as const)
    : ("method-not-allowed" as const);
}

function connectionNominatedHeaders(headers: Headers) {
  return (headers.get("connection") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
}

function filteredHeaders(source: Headers, headersToRemove: readonly string[]) {
  const headers = new Headers(source);
  const nominatedHeaders = connectionNominatedHeaders(headers);

  [...headersToRemove, ...nominatedHeaders].forEach((header) =>
    headers.delete(header),
  );

  return headers;
}

function jsonError(detail: string, status: number) {
  return Response.json({ detail }, { status });
}

async function proxyRequest(request: Request, context: ProxyRouteContext) {
  const upstreamOrigin = getUpstreamOrigin();

  if (!upstreamOrigin) {
    return jsonError("Upstream API is not configured.", 503);
  }

  const { path } = await context.params;
  const routeStatus = getRouteStatus(request.method, path);

  if (routeStatus === "blocked") {
    return jsonError("API route not found.", 404);
  }

  if (routeStatus === "method-not-allowed") {
    return jsonError("Method not allowed.", 405);
  }

  const requestUrl = new URL(request.url);
  const upstreamPath =
    path.length === 1 && path[0] === "_health"
      ? "/health"
      : `/api/${path.map(encodeURIComponent).join("/")}`;
  const upstreamUrl = new URL(upstreamPath, upstreamOrigin);
  upstreamUrl.search = requestUrl.search;

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: filteredHeaders(request.headers, REQUEST_HEADERS_TO_REMOVE),
    body: METHODS_WITHOUT_BODY.has(request.method) ? undefined : request.body,
    redirect: "manual",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: filteredHeaders(upstreamResponse.headers, HOP_BY_HOP_HEADERS),
  });
}

export const GET = proxyRequest;
export const HEAD = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
