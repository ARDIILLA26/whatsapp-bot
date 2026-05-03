const url = require("url");
const { sendWhatsAppMessage } = require("./whatsappService");
const { handleIncomingText } = require("../flows/riskFlow");
const { getSessionByUserId } = require("./storageService");

function createServerHandler() {
  return (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);

      // 🔹 VERIFICACIÓN WEBHOOK META
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
        return res.end("Error de verificación");
      }

      // 🔹 MENSAJES ENTRANTES
      if (req.method === "POST" && parsedUrl.pathname === "/webhook") {
        let body = "";

        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const data = JSON.parse(body);

            const message =
              data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

            if (message) {
              const from = message.from;
              const text = message.text?.body;

              console.log("Usuario:", from);
              console.log("Mensaje:", text);

              if (from && text) {
                const user = { userId: from, phoneNumber: from, profileName: "" };
                const session = getSessionByUserId(from);
                const result = await handleIncomingText(user, text, session);
                const response =
                  Array.isArray(result?.replies) && result.replies.length > 0
                    ? result.replies.join("\n\n")
                    : "Cáceres & Casio, consultoría en riesgos.\nAquí primero entendemos el riesgo y luego se decide.\n¿Qué traes en mente?";

                await sendWhatsAppMessage(
                  from,
                  response
                );
              }
            }
          } catch (error) {
            console.error("Error procesando mensaje:", error);
          }

          res.writeHead(200);
          res.end("EVENT_RECEIVED");
        });

        return;
      }

      // 🔹 RUTA BASE
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

// ✅ EXPORT CORRECTO
module.exports = { createServerHandler };
