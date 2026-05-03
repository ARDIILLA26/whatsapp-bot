const url = require("url");
const { sendWhatsAppMessage } = require("./whatsappService");
const { handleIncomingText } = require("../flows/riskFlow");
const {
  getSessionByUserId,
  hasProcessedMessageId,
  markProcessedMessageId,
} = require("./storageService");

const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

function logIgnored(reason, details = {}) {
  console.log("MESSAGE_IGNORED", JSON.stringify({ reason, ...details }));
}

function extractValue(data) {
  return data?.entry?.[0]?.changes?.[0]?.value || null;
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

  const { messageId, from, text, timestamp } = validation;

  console.log("MESSAGE_RECEIVED", JSON.stringify({
    messageId,
    from,
    timestamp,
    text,
  }));

  markProcessedMessageId(messageId, { from, timestamp });

  const user = { userId: from, phoneNumber: from, profileName: "", messageId, timestamp };
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
  console.log("REPLY_SENT", JSON.stringify({ messageId, from }));
}

function createServerHandler() {
  return (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);

      // Verificacion webhook Meta
      if (req.method === "GET" && parsedUrl.pathname === "/webhook") {
        const mode = parsedUrl.query["hub.mode"];
        const token = parsedUrl.query["hub.verify_token"];
        const challenge = parsedUrl.query["hub.challenge"];

        if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
          console.log("Webhook verificado correctamente");
          res.writeHead(200, { "Content-Type": "text/plain" });
          return res.end(challenge);
        }

        res.writeHead(403);
        return res.end("Error de verificacion");
      }

      // Mensajes entrantes
      if (req.method === "POST" && parsedUrl.pathname === "/webhook") {
        let body = "";

        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            await processWebhookBody(body);
          } catch (error) {
            console.error("Error procesando mensaje:", error);
          }

          res.writeHead(200);
          res.end("EVENT_RECEIVED");
        });

        return;
      }

      // Ruta base
      if (parsedUrl.pathname === "/") {
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
