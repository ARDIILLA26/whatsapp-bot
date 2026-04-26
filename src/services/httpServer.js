const url = require("url");

function createServerHandler() {
  return (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);

      // 🔹 WEBHOOK (VERIFICACIÓN META)
      if (req.method === "GET" && parsedUrl.pathname === "/webhook") {
        const mode = parsedUrl.query["hub.mode"];
        const token = parsedUrl.query["hub.verify_token"];
        const challenge = parsedUrl.query["hub.challenge"];

        if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
          console.log("Webhook verificado correctamente");
          res.writeHead(200, { "Content-Type": "text/plain" });
          return res.end(challenge);
        } else {
          res.writeHead(403);
          return res.end("Error de verificación");
        }
      }

      // 🔹 WEBHOOK (MENSAJES ENTRANTES)
      if (req.method === "POST" && parsedUrl.pathname === "/webhook") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", () => {
          console.log("Mensaje recibido:", body);

          res.writeHead(200);
          res.end("EVENT_RECEIVED");
        });

        return;
      }

      // 🔹 RUTA PRINCIPAL
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

// ✅ FIX CLAVE AQUÍ
module.exports = { createServerHandler };