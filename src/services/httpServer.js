const url = require("url");

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  res.end(text);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function createServerHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === "GET" && parsedUrl.pathname === "/") {
    return sendText(res, 200, "Servidor funcionando");
  }

  if (req.method === "GET" && parsedUrl.pathname === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && parsedUrl.pathname === "/webhook") {
    const mode = parsedUrl.query["hub.mode"];
    const token = parsedUrl.query["hub.verify_token"];
    const challenge = parsedUrl.query["hub.challenge"];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      console.log("WEBHOOK VERIFICADO");
      return sendText(res, 200, challenge);
    }

    return sendText(res, 403, "Forbidden");
  }

  if (req.method === "POST" && parsedUrl.pathname === "/webhook") {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => {
      console.log("Evento recibido:", body);
      return sendJson(res, 200, { received: true });
    });

    return;
  }

  return sendText(res, 404, "Ruta no encontrada");
}

module.exports = {
  createServerHandler,
};