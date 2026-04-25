// src/services/httpServer.js

import http from "http";

/**
 * Helper: enviar JSON
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Helper: enviar texto
 */
function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  res.end(text);
}

/**
 * Parseo básico del body
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });

    req.on("error", reject);
  });
}

/**
 * Verificación de webhook (Meta)
 */
function handleWebhookVerification(requestUrl, res) {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = requestUrl.searchParams.get("hub.mode");
  const token = requestUrl.searchParams.get("hub.verify_token");
  const challenge = requestUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK VERIFICADO CORRECTAMENTE");
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(challenge);
  }

  console.warn("❌ Webhook verification failed", {
    mode,
    tokenMatches: token === VERIFY_TOKEN,
    received: token,
  });

  return sendText(res, 403, "Forbidden");
}

/**
 * Recepción de eventos (mensajes)
 */
async function handleWebhookEvent(req, res) {
  try {
    const body = await parseJsonBody(req);

    // Log completo para debug
    console.log("📩 Evento recibido de WhatsApp:");
    console.dir(body, { depth: null });

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      console.log("📨 Mensaje entrante:", {
        from,
        text,
      });

      // Aquí luego conectas tu flujo (insuranceFlow, etc)
    }

    return sendJson(res, 200, { status: "received" });
  } catch (error) {
    console.error("❌ Error procesando evento:", error);
    return sendJson(res, 500, { error: "Internal server error" });
  }
}

/**
 * Servidor principal
 */
export function createServerHandler() {
  return async (req, res) => {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host}`);

      // --- GET → Verificación ---
      if (req.method === "GET" && requestUrl.pathname === "/webhook") {
        return handleWebhookVerification(requestUrl, res);
      }

      // --- POST → Eventos ---
      if (req.method === "POST" && requestUrl.pathname === "/webhook") {
        return handleWebhookEvent(req, res);
      }

      return sendJson(res, 404, { error: "Route not found" });
    } catch (error) {
      console.error("❌ HTTP server error:", error);
      return sendJson(res, 500, { error: "Internal server error" });
    }
  };
}

/**
 * Levantar servidor
 */
export function startServer() {
  const port = process.env.PORT || 10000;

  const server = http.createServer(createServerHandler());

  server.listen(port, () => {
    console.log(`🚀 WhatsApp chatbot corriendo en puerto ${port}`);
  });
}
