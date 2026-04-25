const { URL } = require("url");
const config = require("../../config/default");
const { parseJsonBody, sendJson, sendText } = require("../utils/http");
const { extractIncomingMessages } = require("../utils/whatsapp");
const { getSessionByUserId, getLeads, getSessions } = require("./storageService");
const { handleIncomingText } = require("../flows/riskFlow");
const { sendTextMessage, isWhatsAppConfigured } = require("./whatsappService");

function createServerHandler() {
  return async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    try {
      if (req.method === "GET" && requestUrl.pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "chatbot-whatsapp-business-caceres-casio",
          whatsappConfigured: isWhatsAppConfigured(),
          baseUrl: config.app.baseUrl,
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
      console.error("HTTP error:", error);
      return sendJson(res, 500, { error: "Internal server error" });
    }
  };
}

function handleWebhookVerification(requestUrl, res) {
  const mode = requestUrl.searchParams.get("hub.mode");
  const token = requestUrl.searchParams.get("hub.verify_token");
  const challenge = requestUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === config.whatsapp.verifyToken) {
    return sendText(res, 200, challenge || "");
  }

  return sendJson(res, 403, { error: "Webhook verification failed" });
}

async function handleWebhookEvent(req, res) {
  const payload = await parseJsonBody(req);
  const messages = extractIncomingMessages(payload);

  if (!messages.length) {
    return sendJson(res, 200, { received: true, ignored: true });
  }

  for (const message of messages) {
    if (message.type !== "text" || !message.text) {
      continue;
    }

    const session = getSessionByUserId(message.user.userId);
    const result = handleIncomingText(message.user, message.text, session);

    for (const reply of result.replies) {
      try {
        await sendTextMessage(message.user.phoneNumber, reply);
      } catch (error) {
        console.error("WhatsApp delivery error:", error.message);
      }
    }
  }

  return sendJson(res, 200, { received: true });
}

module.exports = {
  createServerHandler,
};
