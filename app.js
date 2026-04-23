app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("=== VERIFICACIÓN WEBHOOK ===");
  console.log(req.query);

  if ((mode === "subscribe" || mode === "suscribirse") && token === VERIFY_TOKEN) {
    return res
      .status(200)
      .type("text/plain")
      .send(String(challenge));
  } else {
    return res.sendStatus(403);
  }
});
