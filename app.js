const axios = require("axios");

app.post("/webhook", async (req, res) => {
  console.log("POST webhook:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;

      await axios.post(
        `https://graph.facebook.com/v18.0/TU_PHONE_NUMBER_ID/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: "Mensaje recibido. Estamos analizando tu caso." }
        },
        {
          headers: {
            Authorization: `Bearer TU_ACCESS_TOKEN`,
            "Content-Type": "application/json"
          }
        }
      );
    }

  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }

  res.sendStatus(200);
});
