const crypto = require("crypto");
const { sendWhatsAppMessage } = require("./whatsappService");
const { handleIncomingText } = require("../flows/riskFlow");
const { normalizeText } = require("../flows/risk/textUtils");
const {
  evaluateMessageAbuse,
  getSessionByUserId,
  hasProcessedMessageId,
  markProcessedMessageId,
} = require("./storageService");

const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_TEXT_LENGTH = 1500;

function maskIdentifier(value) {
  const text = String(value || "");

  if (text.length <= 4) {
    return "***";
  }

  return `***${text.slice(-4)}`;
}

function sanitizeLogDetails(details = {}) {
  return Object.fromEntries(Object.entries(details).map(([key, value]) => {
    if (["from", "userId", "phoneNumber"].includes(key)) {
      return [key, maskIdentifier(value)];
    }

    if (key === "text") {
      return ["textLength", String(value || "").length];
    }

    return [key, value];
  }));
}

function logIgnored(reason, details = {}) {
  console.log("MESSAGE_IGNORED", JSON.stringify({ reason, ...sanitizeLogDetails(details) }));
}

function extractValue(data) {
  return data?.entry?.[0]?.changes?.[0]?.value || null;
}

function validateMetaSignature(rawBody, signatureHeader) {
  const appSecret = process.env.APP_SECRET;

  if (!appSecret) {
    console.error("Webhook signature validation unavailable");
    return false;
  }

  if (!signatureHeader) {
    console.warn("Webhook signature missing");
    return false;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    console.warn("Webhook signature invalid");
    return false;
  }

  const receivedSignature = signatureHeader.slice("sha256=".length);

  if (!/^[a-f0-9]{64}$/i.test(receivedSignature)) {
    console.warn("Webhook signature invalid");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const receivedBuffer = Buffer.from(receivedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    console.warn("Webhook signature invalid");
    return false;
  }

  const isValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  if (!isValid) {
    console.warn("Webhook signature invalid");
    return false;
  }

  console.log("Webhook signature valid");
  return true;
}

function validateIncomingTextMessage(value) {
  if (!value?.messages) {
    if (value?.statuses) {
      return { ignored: true, reason: "status_event" };
    }

    if (value?.errors) {
      return { ignored: true, reason: "error_event" };
    }

    return { ignored: true, reason: "no_messages" };
  }

  const message = value.messages?.[0];

  if (!message) {
    return { ignored: true, reason: "empty_message" };
  }

  if (!message.id) {
    return { ignored: true, reason: "missing_message_id" };
  }

  if (!message.from) {
    return { ignored: true, reason: "missing_from", messageId: message.id };
  }

  if (message.type !== "text") {
    return { ignored: true, reason: "non_text_message", messageId: message.id, from: message.from, type: message.type };
  }

  const text = message.text?.body?.trim();

  if (!text) {
    return { ignored: true, reason: "empty_text", messageId: message.id, from: message.from };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ignored: true,
      reason: "text_too_long",
      messageId: message.id,
      from: message.from,
      textLength: text.length,
    };
  }

  const timestampSeconds = Number(message.timestamp);

  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return { ignored: true, reason: "invalid_timestamp", messageId: message.id, from: message.from };
  }

  const ageMs = Date.now() - timestampSeconds * 1000;

  if (ageMs < 0 || ageMs > MAX_MESSAGE_AGE_MS) {
    return {
      ignored: true,
      reason: "stale_message",
      messageId: message.id,
      from: message.from,
      ageMs,
    };
  }

  if (hasProcessedMessageId(message.id)) {
    return { ignored: true, reason: "duplicate_message_id", messageId: message.id, from: message.from };
  }

  return {
    ignored: false,
    messageId: message.id,
    from: message.from,
    text,
    timestamp: message.timestamp,
    profileName: value.contacts?.[0]?.profile?.name || "",
  };
}

async function processWebhookBody(body) {
  const data = JSON.parse(body);
  const value = extractValue(data);

  console.log("RAW_WEBHOOK_RECEIVED", JSON.stringify({
    hasMessages: Boolean(value?.messages),
    hasStatuses: Boolean(value?.statuses),
    hasErrors: Boolean(value?.errors),
  }));

  const validation = validateIncomingTextMessage(value);

  if (validation.ignored) {
    logIgnored(validation.reason, validation);
    return;
  }

  const { messageId, from, text, timestamp, profileName } = validation;
  const normalizedText = normalizeText(text);
  const abuseResult = evaluateMessageAbuse(from, normalizedText);

  if (!abuseResult.allowed) {
    markProcessedMessageId(messageId, { from, timestamp });
    logIgnored(abuseResult.reason, { messageId, from });
    return;
  }

  console.log("MESSAGE_RECEIVED", JSON.stringify({
    messageId,
    from: maskIdentifier(from),
    timestamp,
    textLength: text.length,
  }));

  markProcessedMessageId(messageId, { from, timestamp });

  const user = { userId: from, phoneNumber: from, profileName, messageId, timestamp };
  const session = getSessionByUserId(from);
  const result = await handleIncomingText(user, text, session, { messageId, timestamp });
  const replies = Array.isArray(result?.replies)
    ? result.replies.filter((reply) => typeof reply === "string" && reply.trim())
    : [];

  console.log("INTENT_DETECTED", JSON.stringify({
    messageId,
    intent: result?.session?.lastIntent || "",
  }));

  console.log("MESSAGE_PROCESSED", JSON.stringify({ messageId, replies: replies.length }));

  if (replies.length === 0) {
    logIgnored("empty_replies", { messageId, from });
    return;
  }

  await sendWhatsAppMessage(from, replies[0]);
  console.log("REPLY_SENT", JSON.stringify({ messageId, from: maskIdentifier(from) }));
}

function createServerHandler() {
  return (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", "http://localhost");

      // Verificacion webhook Meta
      if (req.method === "GET" && requestUrl.pathname === "/webhook") {
        const mode = requestUrl.searchParams.get("hub.mode");
        const token = requestUrl.searchParams.get("hub.verify_token");
        const challenge = requestUrl.searchParams.get("hub.challenge") || "";

        if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
          console.log("Webhook verificado correctamente");
          res.writeHead(200, { "Content-Type": "text/plain" });
          return res.end(challenge);
        }

        res.writeHead(403);
        return res.end("Error de verificacion");
      }

      // Mensajes entrantes
      if (req.method === "POST" && requestUrl.pathname === "/webhook") {
        let body = "";
        let payloadBytes = 0;
        let payloadTooLarge = false;

        req.on("data", (chunk) => {
          if (payloadTooLarge) {
            return;
          }

          payloadBytes += chunk.length;

          if (payloadBytes > MAX_PAYLOAD_BYTES) {
            payloadTooLarge = true;
            body = "";
            console.warn("WEBHOOK_REJECTED", JSON.stringify({ reason: "payload_too_large" }));
            res.writeHead(413);
            res.end("Payload too large");
            return;
          }

          body += chunk.toString();
        });

        req.on("end", async () => {
          if (payloadTooLarge) {
            return;
          }

          if (!validateMetaSignature(body, req.headers["x-hub-signature-256"])) {
            res.writeHead(403);
            return res.end("Invalid signature");
          }

          try {
            await processWebhookBody(body);
          } catch {
            console.error("Error procesando mensaje");
          }

          res.writeHead(200);
          res.end("EVENT_RECEIVED");
        });

        return;
      }

      // Ruta base
      if (requestUrl.pathname === "/") {
        res.writeHead(200);
        return res.end("Servidor funcionando");
      }

      res.writeHead(404);
      res.end("Not Found");
    } catch (error) {
      console.error("Error en servidor:", error);
      res.writeHead(500);
      res.end("Error interno");
    }
  };
}

module.exports = { createServerHandler };
