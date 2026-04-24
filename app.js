const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const GRAPH_API_VERSION = "v25.0";
const TEST_NUMBER = "525645572771";

// Guarda mensajes ya procesados
const processedMessages = new Set();

app.get("/", (req, res) => {
  res.status(200).send("WhatsApp Bot funcionando");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log("Evento sin mensaje. Ignorado.");
      return res.sendStatus(200);
    }

    const messageId = message.id;

    if (processedMessages.has(messageId)) {
      console.log("Mensaje duplicado ignorado:", messageId);
      return res.sendStatus(200);
    }

    processedMessages.add(messageId);

    // Limpieza para que no crezca infinito
    setTimeout(() => {
      processedMessages.delete(messageId);
    }, 10 * 60 * 1000);

    const text = message.text?.body || "";
    const type = message.type;

    console.log("Mensaje nuevo:", messageId);
    console.log("Texto:", text);

    if (type !== "text") {
      await sendMessage(TEST_NUMBER, "Solo puedo responder mensajes de texto.");
      return res.sendStatus(200);
    }

    await sendMessage(TEST_NUMBER, `Hola 👋 Recibí tu mensaje: "${text}"`);

    return res.sendStatus(200);
  } catch (error) {
    console.error("ERROR WEBHOOK:", error.message);
    return res.sendStatus(200);
  }
});

async function sendMessage(to, body) {
  const cleanTo = String(to).replace(/\D/g, "");

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "text",
    text: {
      preview_url: false,
      body,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  console.log("META STATUS:", response.status);
  console.log("META RESPONSE:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
