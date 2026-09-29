const str = (maxLength = 200, minLength = 1) => ({
  type: "string",
  minLength,
  maxLength,
});
const choice = (...values) => ({ type: "string", enum: values });
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const integer = (minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => ({
  type: "integer",
  minimum,
  maximum,
});
const id = str(100);
const date = { type: "string", format: "date-time" };
const email = { ...str(254), pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" };
const password = str(128, 10);
const nullableId = { anyOf: [id, { type: "null" }] };
const shopFields = {
  name: str(120),
  description: str(5000, 0),
  opening_hours: str(1000, 0),
  persona: str(5000, 0),
};
const knowledgeFields = {
  kind: choice("faq", "product", "policy", "general"),
  title: str(200),
  content: str(20000),
  status: choice("draft", "published"),
};
const conversationFields = {
  channel: choice("web", "line"),
  customer_external_id: str(200),
  customer_name: str(100),
};

export const schemas = {
  User: object({ id, email, name: str(100), created_at: date }),
  Shop: object({
    id,
    ...shopFields,
    member_role: choice("owner", "agent"),
    created_at: date,
    updated_at: date,
  }),
  Knowledge: object({
    id,
    shop_id: id,
    ...knowledgeFields,
    created_by: id,
    created_at: date,
    updated_at: date,
  }),
  Conversation: object({
    id,
    shop_id: id,
    ...conversationFields,
    status: choice("open", "closed"),
    bot_mode: choice("active", "paused", "human"),
    created_at: date,
    updated_at: date,
  }),
  Message: object({
    id,
    shop_id: id,
    conversation_id: id,
    role: choice("customer", "assistant", "agent", "system"),
    content: str(10000),
    author_user_id: nullableId,
    created_at: date,
  }),
  Register: object({ email, name: str(100), password }),
  Login: object({ email, password }),
  ShopCreate: object(shopFields, ["name"]),
  ShopPatch: { ...object(shopFields, []), minProperties: 1 },
  KnowledgeCreate: object(knowledgeFields),
  KnowledgePatch: { ...object(knowledgeFields, []), minProperties: 1 },
  ConversationCreate: object(conversationFields),
  ConversationPatch: {
    ...object(
      {
        status: choice("open", "closed"),
        bot_mode: choice("active", "paused", "human"),
      },
      []
    ),
    minProperties: 1,
  },
  MessageCreate: object({
    role: choice("customer", "agent"),
    content: str(10000),
  }),
  LineConfig: object({
    configured: { type: "boolean" },
    channel_id: { anyOf: [id, { type: "null" }] },
    channel_secret_masked: { anyOf: [str(100), { type: "null" }] },
    channel_access_token_masked: { anyOf: [str(500), { type: "null" }] },
    destination_user_id: { anyOf: [str(100), { type: "null" }] },
    webhook_url: str(500),
    updated_at: { anyOf: [date, { type: "null" }] },
  }),
  LineConfigUpdate: object(
    {
      channel_secret: str(100, 1),
      channel_access_token: str(500, 1),
      channel_id: { anyOf: [id, { type: "null" }] },
      destination_user_id: { anyOf: [str(100), { type: "null" }] },
    },
    ["channel_secret", "channel_access_token"]
  ),
  LineWebhook: {
    type: "object",
    properties: {
      destination: { anyOf: [str(100), { type: "null" }] },
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: str(50),
            timestamp: integer(),
            webhookEventId: str(100),
            replyToken: { anyOf: [str(100), { type: "null" }] },
            source: {
              type: "object",
              properties: {
                type: str(20),
                userId: { anyOf: [str(100), { type: "null" }] },
              },
            },
            message: {
              type: "object",
              properties: {
                type: str(20),
                id: { anyOf: [str(100), { type: "null" }] },
                text: { anyOf: [str(10000, 0), { type: "null" }] },
              },
            },
          },
          required: ["type"],
        },
      },
    },
    required: ["events"],
  },
  LineWebhookResult: object({ status: str(50), processed_count: integer() }),
  LineSimulate: object(
    {
      user_id: str(100, 1),
      user_name: { anyOf: [str(100), { type: "null" }] },
      text: str(10000, 1),
      event_id: { anyOf: [str(100), { type: "null" }] },
    },
    ["user_id", "text"]
  ),
  LineSimulateResult: object({
    status: str(50),
    conversation_id: id,
    customer_message_id: id,
    replied: { type: "boolean" },
    reply_message_id: { anyOf: [id, { type: "null" }] },
    reply_text: { anyOf: [str(10000), { type: "null" }] },
  }),
  Error: object({
    error: object({
      code: str(),
      message: str(1000),
      details: {
        type: "array",
        items: object({ field: str(), message: str(1000) }),
      },
    }),
    request_id: id,
  }),
};
schemas.Auth = object({
  user: schemas.User,
  access_token: str(),
  token_type: choice("Bearer"),
  expires_at: date,
});
const data = (schema) => object({ data: schema });
const list = (schema) =>
  object({
    data: { type: "array", items: schema },
    meta: object({
      limit: integer(1, 100),
      offset: integer(),
      total: integer(),
    }),
  });
const pagination = ["limit", "offset"].map((name) => ({
  name,
  in: "query",
  required: false,
  schema:
    name === "limit"
      ? { ...integer(1, 100), default: 50 }
      : { ...integer(), default: 0 },
}));
function route(method, path, operationId, summary, response, options = {}) {
  return {
    method,
    path,
    operationId,
    summary,
    response,
    status: 200,
    auth: true,
    ...options,
  };
}
const base = "/api/v1/shops/{shopId}";
export const routes = [
  route(
    "GET",
    "/health",
    "health",
    "Database health",
    data(object({ status: choice("ok"), database: choice("ok") })),
    { auth: false }
  ),
  route(
    "POST",
    "/api/v1/auth/register",
    "register",
    "Create a user and a seven-day session",
    data(schemas.Auth),
    { auth: false, body: schemas.Register, status: 201 }
  ),
  route("POST", "/api/v1/auth/login", "login", "Sign in", data(schemas.Auth), {
    auth: false,
    body: schemas.Login,
  }),
  route(
    "POST",
    "/api/v1/auth/logout",
    "logout",
    "Revoke the current session",
    null,
    { status: 204 }
  ),
  route("GET", "/api/v1/users/me", "me", "Current user", data(schemas.User)),
  route(
    "GET",
    "/api/v1/shops",
    "listShops",
    "List only shops belonging to the current user",
    list(schemas.Shop),
    { paginated: true }
  ),
  route(
    "POST",
    "/api/v1/shops",
    "createShop",
    "Create a shop and its owner membership atomically",
    data(schemas.Shop),
    { body: schemas.ShopCreate, status: 201 }
  ),
  route("GET", base, "getShop", "Read a shop", data(schemas.Shop)),
  route(
    "PATCH",
    base,
    "updateShop",
    "Update shop settings (owner)",
    data(schemas.Shop),
    { body: schemas.ShopPatch, owner: true }
  ),
  route(
    "GET",
    `${base}/knowledge`,
    "listKnowledge",
    "List shop knowledge, including drafts",
    list(schemas.Knowledge),
    { paginated: true }
  ),
  route(
    "POST",
    `${base}/knowledge`,
    "createKnowledge",
    "Create knowledge (owner)",
    data(schemas.Knowledge),
    { body: schemas.KnowledgeCreate, owner: true, status: 201 }
  ),
  route(
    "GET",
    `${base}/knowledge/{knowledgeId}`,
    "getKnowledge",
    "Read a knowledge entry",
    data(schemas.Knowledge)
  ),
  route(
    "PATCH",
    `${base}/knowledge/{knowledgeId}`,
    "updateKnowledge",
    "Update knowledge (owner)",
    data(schemas.Knowledge),
    { body: schemas.KnowledgePatch, owner: true }
  ),
  route(
    "DELETE",
    `${base}/knowledge/{knowledgeId}`,
    "deleteKnowledge",
    "Delete knowledge (owner)",
    null,
    { status: 204, owner: true }
  ),
  route(
    "GET",
    `${base}/conversations`,
    "listConversations",
    "List shop conversations",
    list(schemas.Conversation),
    { paginated: true }
  ),
  route(
    "POST",
    `${base}/conversations`,
    "createConversation",
    "Create a conversation for local integration testing",
    data(schemas.Conversation),
    { body: schemas.ConversationCreate, status: 201 }
  ),
  route(
    "GET",
    `${base}/conversations/{conversationId}`,
    "getConversation",
    "Read a conversation",
    data(schemas.Conversation)
  ),
  route(
    "PATCH",
    `${base}/conversations/{conversationId}`,
    "updateConversation",
    "Change status or bot mode",
    data(schemas.Conversation),
    { body: schemas.ConversationPatch }
  ),
  route(
    "GET",
    `${base}/conversations/{conversationId}/messages`,
    "listMessages",
    "List messages oldest first",
    list(schemas.Message),
    { paginated: true }
  ),
  route(
    "POST",
    `${base}/conversations/{conversationId}/messages`,
    "createMessage",
    "Store a simulated customer message or an agent reply; no external delivery",
    data(schemas.Message),
    { body: schemas.MessageCreate, status: 201 }
  ),
  route(
    "GET",
    `${base}/line/config`,
    "getLineConfig",
    "Read LINE channel configuration for a shop (owner)",
    data(schemas.LineConfig),
    { owner: true }
  ),
  route(
    "PUT",
    `${base}/line/config`,
    "updateLineConfig",
    "Update LINE channel credentials (owner)",
    data(schemas.LineConfig),
    { body: schemas.LineConfigUpdate, owner: true }
  ),
  route(
    "POST",
    `${base}/line/webhook`,
    "lineWebhook",
    "Receive LINE Messaging API webhook events",
    data(schemas.LineWebhookResult),
    { auth: false, body: schemas.LineWebhook }
  ),
  route(
    "POST",
    `${base}/line/simulate`,
    "simulateLineMessage",
    "Simulate an incoming LINE message event for testing (owner)",
    data(schemas.LineSimulateResult),
    { body: schemas.LineSimulate, owner: true }
  ),
];

const errorDescriptions = {
  400: "Invalid JSON or query",
  401: "Authentication required or invalid credentials",
  403: "Owner role required",
  404: "Resource missing or inaccessible",
  405: "Method not allowed",
  409: "Duplicate email or conversation state conflict",
  413: "Body exceeds 128 KiB",
  415: "Expected application/json",
  422: "Schema validation failed",
  429: "Authentication rate limit exceeded",
  500: "Internal error",
};
// Reuse named schemas in the exported document instead of duplicating them per endpoint.
function referenceSchema(value) {
  const named = Object.entries(schemas).find(([, schema]) => schema === value);
  if (named) return { $ref: `#/components/schemas/${named[0]}` };
  if (Array.isArray(value)) return value.map(referenceSchema);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, referenceSchema(item)])
    );
  return value;
}
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "SMB Chatbot Foundation API",
    version: "0.1.0",
    description:
      "Team baseline contract. Local persistence only; LINE delivery, RAG and AI providers are future integrations. Shop membership is checked on every tenant request.",
  },
  servers: [{ url: "/" }],
  components: {
    schemas,
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "Opaque session token from login/register; expires after seven days.",
      },
    },
  },
  paths: {},
};
for (const r of routes) {
  const parameters = [...r.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: id,
  }));
  if (r.paginated) parameters.push(...pagination);
  const responses = Object.fromEntries(
    Object.entries(errorDescriptions).map(([code, description]) => [
      code,
      {
        description,
        content: {
          "application/json": { schema: referenceSchema(schemas.Error) },
        },
      },
    ])
  );
  responses[r.status] = r.response
    ? {
        description: "Success",
        content: {
          "application/json": { schema: referenceSchema(r.response) },
        },
      }
    : { description: "Success; no response body" };
  (openapi.paths[r.path] ||= {})[r.method.toLowerCase()] = {
    operationId: r.operationId,
    summary: r.summary,
    security: r.auth ? [{ bearerAuth: [] }] : [],
    parameters,
    responses,
    ...(r.body
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: referenceSchema(r.body) },
            },
          },
        }
      : {}),
  };
}
