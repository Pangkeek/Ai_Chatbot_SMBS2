import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { routes, openapi } from "./contracts.js";
import { tokenHash } from "./auth.js";
import { ApiError, validate } from "../utils/validation.js";
import { createService } from "../services/service.js";
import { serializeDates } from './postgresql-schema.js';

const bodyLimit = 128 * 1024;
const compiled = routes.map((route) => ({
  ...route,
  names: [...route.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
  regex: new RegExp(`^${route.path.replace(/\{\w+\}/g, "([^/]+)")}$`),
}));
function readBody(req) {
  if (
    req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    req.resume();
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Use Content-Type: application/json"
    );
  }
  return new Promise((resolve, reject) => {
    let size = 0,
      tooLarge = false;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > bodyLimit) {
        if (!tooLarge)
          reject(
            new ApiError(
              413,
              "PAYLOAD_TOO_LARGE",
              "JSON body must not exceed 128 KiB"
            )
          );
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve({ json: JSON.parse(raw), raw });
      } catch {
        reject(
          new ApiError(400, "INVALID_JSON", "Request body must be valid JSON")
        );
      }
    });
    req.on("error", reject);
  });
}

function getPagination(url, paginated) {
  const query = { limit: 50, offset: 0 };
  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    const value = values[0];
    if (
      !paginated ||
      !["limit", "offset"].includes(key) ||
      values.length !== 1 ||
      !/^(0|[1-9]\d*)$/.test(value)
    ) {
      throw new ApiError(
        400,
        "INVALID_QUERY",
        "Use a single integer limit (1-100) and offset (0 or greater)"
      );
    }
    query[key] = Number(value);
    if (
      !Number.isSafeInteger(query[key]) ||
      (key === "limit" && (query[key] < 1 || query[key] > 100))
    ) {
      throw new ApiError(400, "INVALID_QUERY", "Pagination is out of range");
    }
  }
  return query;
}

export function createRequestHandler(
  db,
  { logErrors = true, worker, serviceOptions } = {}
) {
  const service = createService(db, { worker, ...serviceOptions });
  const authAttempts = new Map();
  const handler = async (req, res) => {
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    function send(status, payload) {
      res.statusCode = status;
      if (status === 204) return res.end();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(serializeDates(payload)));
    }
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/openapi.json")
        return send(200, openapi);
      const matches = compiled.filter((route) =>
        route.regex.test(url.pathname)
      );
      const route = matches.find((route) => route.method === req.method);
      if (!route) {
        if (matches.length) {
          res.setHeader("Allow", matches.map((r) => r.method).join(", "));
          throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed");
        }
        throw new ApiError(404, "NOT_FOUND", "Route not found");
      }
      if (route.operationId === 'simulateLineMessage' && process.env.NODE_ENV === 'production') {
        throw new ApiError(404, 'NOT_FOUND', 'Route not found');
      }
      const rawParams = route.regex.exec(url.pathname).slice(1);
      let params;
      try {
        params = Object.fromEntries(
          route.names.map((key, i) => [key, decodeURIComponent(rawParams[i])])
        );
      } catch {
        throw new ApiError(400, "INVALID_PATH", "Invalid path encoding");
      }
      const context = {
        params,
        query: getPagination(url, route.paginated),
        headers: req.headers,
      };
      if (["login", "register"].includes(route.operationId)) {
        const time = Date.now(),
          address = req.socket.remoteAddress;
        for (const [key, record] of authAttempts)
          if (record.until <= time) authAttempts.delete(key);
        const record = authAttempts.get(address) || {
          count: 0,
          until: time + 60000,
        };
        if (
          record.count >= 20 ||
          (!authAttempts.has(address) && authAttempts.size >= 4096)
        ) {
          res.setHeader("Retry-After", "60");
          throw new ApiError(
            429,
            "RATE_LIMITED",
            "Wait one minute before trying again"
          );
        }
        record.count++;
        authAttempts.set(address, record);
      }
      if (route.auth || (req.headers.authorization && params.shopId)) {
        const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
          req.headers.authorization || ""
        );
        if (!match)
          throw new ApiError(
            401,
            "UNAUTHORIZED",
            "A valid bearer token is required"
          );
        context.sessionHash = tokenHash(match[1]);
        context.user = (await db.query(`SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id
          WHERE s.token_hash = $1 AND s.expires_at > $2`, [context.sessionHash, new Date().toISOString()])).rows[0];
        if (!context.user)
          throw new ApiError(401, "UNAUTHORIZED", "Session expired or invalid");
        if (params.shopId) {
          const membership = (await db.query("SELECT role FROM shop_memberships WHERE shop_id = $1 AND user_id = $2", [params.shopId, context.user.id])).rows[0];
          if (!membership)
            throw new ApiError(404, "NOT_FOUND", "Resource not found");
          if (route.owner && membership.role !== "owner")
            throw new ApiError(403, "FORBIDDEN", "Owner role required");
        }
      }
      if (route.body) {
        const { json, raw } = await readBody(req);
        context.body = json;
        context.rawBody = raw;
        const errors = validate(context.body, route.body);
        if (errors.length)
          throw new ApiError(
            422,
            "VALIDATION_ERROR",
            "Request body failed validation",
            errors
          );
      } else req.resume();
      const result = await service[route.operationId](context);
      send(route.status, result);
    } catch (error) {
      if (!(error instanceof ApiError) && logErrors)
        console.error(`[${requestId}] Request failed`);
      const known = error instanceof ApiError;
      send(known ? error.status : 500, {
        error: {
          code: known ? error.code : "INTERNAL_ERROR",
          message: known ? error.message : "Internal server error",
          details: known ? error.details : [],
        },
        request_id: requestId,
      });
    }
  };
  handler.drain = () => service.worker.drain();
  return handler;
}

export function createApp(db, options) {
  const handler = createRequestHandler(db, options);
  const server = createServer(
    { requestTimeout: 15000, headersTimeout: 10000 },
    handler
  );
  server.drain = handler.drain;
  return server;
}
