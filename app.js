const express = require("express");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "caceres123";

const ACCESS_TOKEN = "AQUI_TU_TOKEN_LARGO";
const PHONE_NUMBER_ID = "1129641810224240";

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).type("text/plain").send(String(challenge));
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  console.log("POST webhook:", JSON.stringify(req.body, null, 2));

  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body || "";

      const response = await fetch(
        `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: {
              body: `Hola 👋, recibí tu mensaje: ${text}`,
            },
          }),
        }
      );

      const data = await response.json();
      console.log("Respuesta Meta:", data);
    }
  } catch (error) {
    console.error("ERROR RESPONDIENDO:", error);
  }

  return res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
