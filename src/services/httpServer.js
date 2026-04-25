const http = require("http");
const { URL } = require("url");

const config = require("../config/default");

const {
  parseJsonBody,
  sendJson,
  sendText,
} = require("../utils/http");

const {
  extractIncomingMessages,
} = require("../utils/whatsapp");

const {
  getSessionByUserId,
  getLeads,
  getSessions,
} = require("./storageService");

const {
  handleIncomingText,
} = require("../flows/riskFlow");

const {
  sendTextMessage,
  isWhatsAppConfigured,
} = require("./whatsappService");

function createServerHandler() {
  return async function serverHandler(req, res) {
    let requestUrl;

    try {
      requestUrl = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
      );

      if (req.method === "GET" && requestUrl.pathname === "/health") {
        return sendJson(res, 200, {
          ok: true,
          service: "chatbot-whatsapp-business-caceres-casio",
          whatsappConfigured: isWhatsAppConfigured(),
          baseUrl: config.app.baseUrl,
          port: process.env.PORT || 10000,
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

      return sendJson(res, 404, {
        error: "Route not found",
      });
    } catch (error) {
      console.error("HTTP server error:", error);

      return sendJson(res, 500, {
        error: "Internal server error",
      });
    }
  };
}

function handleWebhookVerification(requestUrl, res) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = requestUrl.searchParams.get("hub.mode");
  const token = requestUrl.searchParams.get("hub.verify_token");
  const challenge = requestUrl.searchParams.get("hub.challenge");

  if (!verifyToken) {
    console.error("WHATSAPP_VERIFY_TOKEN no está configurado en Render");
    return sendText(res, 500, "Missing WHATSAPP_VERIFY_TOKEN");
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("WEBHOOK VERIFICADO CORRECTAMENTE");
    return sendText(res, 200, challenge);
  }

  console.warn("Webhook verification failed", {
    mode,
    tokenMatches: token === verifyToken,
    hasChallenge: Boolean(challenge),
  });

  return sendText(res, 403, "Forbidden");
}

async function handleWebhookEvent(req, res) {
  try {
    const body = await parseJsonBody(req);

    console.log("Evento recibido de WhatsApp:");
    console.dir(body, { depth: null });

    const messages = extractIncomingMessages(body);

    if (!messages || messages.length === 0) {
      return sendJson(res, 200, {
        status: "no_messages",
      });
    }

    for (const message of messages) {
      const from = message.from;
      const text = message.text?.body || "";

      if (!from || !text) {
        continue;
      }

      console.log("Mensaje entrante:", {
        from,
        text,
      });

      const session = getSessionByUserId(from);

      const reply = await handleIncomingText({
        userId: from,
        text,
        session,
        rawMessage: message,
      });

      if (reply) {
        await sendTextMessage(from, reply);
      }
    }

    return sendJson(res, 200, {
      status: "received",
    });
  } catch (error) {
    console.error("Error procesando evento:", error);

    return sendJson(res, 500, {
      error: "Internal server error",
    });
  }
}

function startServer() {
  const port = Number(process.env.PORT) || 10000;

  const server = http.createServer(createServerHandler());

  server.listen(port, "0.0.0.0", () => {
    console.log(`WhatsApp chatbot escuchando en puerto ${port}`);
  });

  server.on("error", (error) => {
    console.error("Error iniciando servidor:", error);
    process.exit(1);
  });
}

module.exports = {
  createServerHandler,
  startServer,
};