const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const GRAPH_API_VERSION = "v25.0";

app.get("/", (req, res) => {
  res.status(200).send("Bot de WhatsApp activo");
});

// Verificación del webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }

  console.log("Error verificando webhook");
  return res.sendStatus(403);
});

// Recibir mensajes
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook recibido:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log("No es mensaje entrante. Puede ser status/update.");
      return res.sendStatus(200);
    }

    const from = message.from; // ESTE YA VIENE SIN +
    const messageType = message.type;
    const text = message.text?.body || "";

    console.log("Número que escribió:", from);
    console.log("Tipo de mensaje:", messageType);
    console.log("Texto recibido:", text);

    if (messageType !== "text") {
      await sendMessage(from, "Por ahora solo puedo responder mensajes de texto.");
      return res.sendStatus(200);
    }

    const reply = `Hola 👋 Recibí tu mensaje: ${text}`;

    await sendMessage(from, reply);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error en webhook:", error.message);
    return res.sendStatus(200);
  }
});

// Enviar mensaje
async function sendMessage(to, body) {
  const cleanTo = String(to).replace(/\D/g, "");

  console.log("Enviando mensaje a:", cleanTo);
  console.log("Mensaje:", body);

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "text",
    text: {
      preview_url: false,
      body: body,
    },
  };

  console.log("Payload enviado:", JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("Meta response status:", response.status);
  console.log("Meta response body:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
