 const { URL } = require("url");
const config = require("../../config/default");

const { parseJsonBody, sendJson } = require("../utils/http");
const { extractIncomingMessages } = require("../utils/whatsapp");

const {
  getSessionByUserId,
  getLeads,
  getSessions,
} = require("./storageService");

const { handleIncomingText } = require("../flows/riskFlow");

const {
  sendTextMessage,
  isWhatsAppConfigured,
} = require("./whatsappService");

function sendPlainText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  return res.end(String(text || ""));
}

function createServerHandler() {
  return async (req, res) => {
    const requestUrl = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

    try {
      if (req.method === "GET" && requestUrl.pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "chatbot-whatsapp-business-caceres-casio",
          whatsappConfigured: isWhatsAppConfigured(),
          baseUrl: config.app.baseUrl,
          model: process.env.OPENAI_MODEL || "gpt-5.5",
        });
      }

      if (req.method === "GET" && requestUrl.pathname === "/webhook") {
        return handleWebhookVerification(requestUrl, res);
      }

      if (req.method === "POST" && requestUrl.pathname === "/webhook") {
        return handleWebhookEvent(req, res);
      }

      if (req.method === "GET" && requestUrl.pathname === "/leads") {
        return sendJson(res, 200, getLeads());
      }

      if (req.method === "GET" && requestUrl.pathname === "/sessions") {
        return sendJson(res, 200, getSessions());
      }

      return sendJson(res, 404, { error: "Route not found" });
    } catch (error) {
      console.error("HTTP server error:", error);

      return sendJson(res, 500, {
        error: "Internal server error",
      });
    }
  };
}

function handleWebhookVerification(requestUrl, res) {
  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN || "caceres_risk_bot_2026";

  const mode = requestUrl.searchParams.get("hub.mode");
  const token = requestUrl.searchParams.get("hub.verify_token");
  const challenge = requestUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("WEBHOOK VERIFICADO");
    return sendPlainText(res, 200, challenge);
  }

  console.warn("Webhook verification failed", {
    mode,
    tokenMatches: token === verifyToken,
    hasChallenge: Boolean(challenge),
  });

  return sendPlainText(res, 403, "Forbidden");
}

async function handleWebhookEvent(req, res) {
  const body = await parseJsonBody(req);
  const messages = extractIncomingMessages(body);

  if (!messages.length) {
    return sendJson(res, 200, {
      ok: true,
      received: true,
      messages: 0,
    });
  }

  for (const message of messages) {
    await processIncomingMessage(message);
  }

  return sendJson(res, 200, {
    ok: true,
    received: true,
    messages: messages.length,
  });
}

async function processIncomingMessage(message) {
  const user = {
    userId: message.from,
    phoneNumber: message.from,
    profileName: message.profileName || "",
  };

  const incomingText = String(message.text || "").trim();

  if (!incomingText) {
    return;
  }

  const session = getSessionByUserId(user.userId);
  const result = await handleIncomingText(user, incomingText, session);

  const replies = Array.isArray(result.replies)
    ? result.replies
    : [String(result.replies || "")];

  for (const reply of replies) {
    if (reply && reply.trim()) {
      await sendTextMessage(user.phoneNumber, reply.trim());
    }
  }
}

module.exports = {
  createServerHandler,
};
