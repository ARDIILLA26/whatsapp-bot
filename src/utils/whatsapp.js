function extractIncomingMessages(payload) {
  const entryList = Array.isArray(payload.entry) ? payload.entry : [];
  const result = [];

  for (const entry of entryList) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change.value || {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const profileName = contacts[0] && contacts[0].profile ? contacts[0].profile.name || "" : "";

      for (const message of messages) {
        result.push({
          type: message.type,
          text: message.text ? message.text.body || "" : "",
          user: {
            userId: message.from,
            phoneNumber: message.from,
            profileName,
          },
          raw: message,
        });
      }
    }
  }

  return result;
}

module.exports = {
  extractIncomingMessages,
};
