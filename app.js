const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.get("/", (req, res) => {
  res.status(200).send("WhatsApp bot running");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log("No incoming message. Probably status update.");
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body;

    console.log("From:", from);
    console.log("Text:", text);

    if (!from) {
      console.log("No sender found.");
      return res.sendStatus(200);
    }

    if (message.type !== "text") {
      await sendMessage(from, "Por ahora solo puedo responder mensajes de texto.");
      return res.sendStatus(200);
    }

    const reply = `Recibí tu mensaje: "${text}"`;

    await sendMessage(from, reply);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error.response?.data || error.message || error);
    return res.sendStatus(200);
  }
});

async function sendMessage(to, message) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  };

  console.log("Sending message payload:", JSON.stringify(payload, null, 2));

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

