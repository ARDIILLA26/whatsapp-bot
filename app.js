const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "caceres123";

// 🔥 PEGA TU TOKEN LARGO AQUÍ
const ACCESS_TOKEN = "AQUI_TU_TOKEN_LARGO";

// 🔥 TU PHONE NUMBER ID (ya lo tienes bien)
const PHONE_NUMBER_ID = "1129641810224240";


// ✅ VERIFICACIÓN WEBHOOK
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});


// ✅ RECIBIR Y RESPONDER MENSAJES
app.post("/webhook", async (req, res) => {
  console.log("Mensaje recibido:", JSON.stringify(req.body, null, 2));

  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      console.log("Usuario dijo:", text);

      // 🔥 RESPUESTA AUTOMÁTICA
      await axios.post(
        `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: {
            body: "Hola 👋, recibí tu mensaje: " + text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${EAAVJmkSwXmUBRejKPCZAADj1h40pnsnmQi5vyuoIx4Y4lZBtMGjvKZCBjIO0ZA5cPjB3TkWt1zXO7sVFSZCJuhTWc1ZB9u2k0IANa08xg81d6yYpyGoZCsmI1UxqDCMKalaHBUKnb4FARmbJFoiBIrHCZCRnpgZCgVlIgQNQX4l0t87TqhFudvP5jaJL5WWylXnWUZAd3F7alGCjBazcptplZBZA7oFzkC1jXvPqi4KJjPveK9luF09uA6p75vYjaijDZAg1yZBaTGAqFDiDIKmUmXQLIlxZACA}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
