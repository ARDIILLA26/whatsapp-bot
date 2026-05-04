function sendLeadToGoogleSheets(lead) {
  try {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log("GOOGLE_SHEETS_SKIPPED", JSON.stringify({
        reason: "missing_webhook_url",
      }));
      return;
    }

    setTimeout(() => {
      fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(lead),
      })
        .then(async (response) => {
          const text = await response.text();

          console.log("GOOGLE_SHEETS_SENT", JSON.stringify({
            ok: response.ok,
            status: response.status,
            response: text.slice(0, 200),
          }));
        })
        .catch((error) => {
          console.error("GOOGLE_SHEETS_ERROR", JSON.stringify({
            message: error.message,
          }));
        });
    }, 0);

  } catch (error) {
    console.error("GOOGLE_SHEETS_SETUP_ERROR", JSON.stringify({
      message: error.message,
    }));
  }
}

module.exports = {
  sendLeadToGoogleSheets,
};