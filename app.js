const express = require("express");
const app = express();

const VERIFY_TOKEN = "caceres123";

// Verificación del webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("VERIFY:", { mode, token, challenge });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("SUCCESS: returning challenge");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end(String(challenge));
  }

  console.log("FAIL: token or mode mismatch");
  return res.sendStatus(403);
});

app.use(express.json());

// Recepción de mensajes
app.post("/webhook", (req, res) => {
  console.log("POST webhook:", JSON.stringify(req.body, null, 2));
  return res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
