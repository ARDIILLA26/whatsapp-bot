app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("=== WEBHOOK VERIFY ===");
  console.log("Query recibida:", req.query);
  console.log("mode:", mode);
  console.log("token:", token);
  console.log("challenge:", challenge);

  if (mode === "subscribe" && token === "caceres123") {
    return res
      .status(200)
      .type("text/plain")
      .send(String(challenge));
  }

  return res.sendStatus(403);
});
