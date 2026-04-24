const express = require("express");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "caceres123";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const PORT = process.env.PORT || 10000;

async function sendMessage(to, text) {
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: text,
      },
    }),
  });

  const data = await response.json();

  console.log("Respuesta Meta:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    console.error("Error Meta:", JSON.stringify(data, null, 2));
  }

  return data;
}

// Verificación del webhook Meta
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Recibir mensajes de WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    console.log("POST webhook:", JSON.stringify(body, null, 2));

    const message =
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body || "";

      console.log("Mensaje recibido de:", from);
      console.log("Texto:", text);

      if (text) {
        await sendMessage(from, `Recibí tu mensaje: ${text}`);
      } else {
        await sendMessage(from, "Recibí tu mensaje.");
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error en webhook:", error);
    return res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("Bot de WhatsApp funcionando correctamente");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
