const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { generateLeadId } = require("../utils/helpers");
const { sendLeadToGoogleSheets } = require("./googleSheetsService");
const dataDir = path.join(__dirname, "..", "data");
const runtimeDataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const sessionsFile = path.join(dataDir, "sessions.json");
const leadsFile = path.join(dataDir, "leads.json");
const processedMessagesFile = path.join(dataDir, "processedMessages.json");
const abuseFile = path.join(runtimeDataDir, "abuse.json");
const maxProcessedMessages = 1000;
const ABUSE_SHORT_WINDOW_MS = 2 * 60 * 1000;
const ABUSE_LONG_WINDOW_MS = 5 * 60 * 1000;
const ABUSE_COOLDOWN_THRESHOLD = 12;
const ABUSE_BLOCK_THRESHOLD = 20;
const ABUSE_BLOCK_DURATION_MS = 15 * 60 * 1000;
const REPEATED_TEXT_THRESHOLD = 3;

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(runtimeDataDir)) {
    fs.mkdirSync(runtimeDataDir, { recursive: true });
  }

  if (!fs.existsSync(sessionsFile)) {
    fs.writeFileSync(sessionsFile, "[]", "utf8");
  }

  if (!fs.existsSync(leadsFile)) {
    fs.writeFileSync(leadsFile, "[]", "utf8");
  }

  if (!fs.existsSync(processedMessagesFile)) {
    fs.writeFileSync(processedMessagesFile, "[]", "utf8");
  }

  if (!fs.existsSync(abuseFile)) {
    fs.writeFileSync(abuseFile, "[]", "utf8");
  }
}

function readJsonArray(filePath) {
  ensureDataFiles();
  const raw = fs.readFileSync(filePath, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeJsonArray(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getSessions() {
  return readJsonArray(sessionsFile);
}

function getLeads() {
  return readJsonArray(leadsFile);
}

function getProcessedMessages() {
  return readJsonArray(processedMessagesFile);
}

function getAbuseRecords() {
  return readJsonArray(abuseFile);
}

function logAbuseStorageError(operation, error) {
  console.error("ABUSE_STORAGE_ERROR", JSON.stringify({
    operation,
    message: error.message,
  }));
}

function safeReadAbuseRecords() {
  try {
    return getAbuseRecords();
  } catch (error) {
    logAbuseStorageError("read", error);
    return null;
  }
}

function safeWriteAbuseRecords(records) {
  try {
    writeJsonArray(abuseFile, records);
    return true;
  } catch (error) {
    logAbuseStorageError("write", error);
    return false;
  }
}

function getTextFingerprint(normalizedText) {
  return crypto
    .createHash("sha256")
    .update(String(normalizedText || ""), "utf8")
    .digest("hex");
}

function maskIdentifier(value) {
  const text = String(value || "");

  if (text.length <= 4) {
    return "***";
  }

  return `***${text.slice(-4)}`;
}

function getSessionByUserId(userId) {
  return getSessions().find((item) => item.userId === userId) || null;
}

function upsertSession(session) {
  const sessions = getSessions();
  const index = sessions.findIndex((item) => item.userId === session.userId);

  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }

  writeJsonArray(sessionsFile, sessions);
  return session;
}

function hasProcessedMessageId(messageId) {
  return getProcessedMessages().some((item) => item.messageId === messageId);
}

function markProcessedMessageId(messageId, metadata = {}) {
  const processedMessages = getProcessedMessages().filter((item) => item.messageId !== messageId);

  processedMessages.push({
    messageId,
    from: metadata.from || "",
    timestamp: metadata.timestamp || "",
    processedAt: new Date().toISOString(),
  });

  const trimmedMessages = processedMessages.slice(-maxProcessedMessages);
  writeJsonArray(processedMessagesFile, trimmedMessages);
}

function pruneAbuseRecords(records, now) {
  return records
    .map((record) => {
      const blockedUntilMs = record.blockedUntil ? new Date(record.blockedUntil).getTime() : 0;
      const events = Array.isArray(record.events)
        ? record.events.filter((event) => now - Number(event.at || 0) <= ABUSE_LONG_WINDOW_MS)
        : [];

      return {
        ...record,
        events,
        blockedUntil: blockedUntilMs > now ? record.blockedUntil : "",
      };
    })
    .filter((record) => record.events.length > 0 || record.blockedUntil);
}

function evaluateMessageAbuse(userId, normalizedText, now = Date.now()) {
  const storedAbuseRecords = safeReadAbuseRecords();

  if (!storedAbuseRecords) {
    return {
      allowed: true,
      reason: "abuse_storage_unavailable",
    };
  }

  const abuseRecords = pruneAbuseRecords(storedAbuseRecords, now);
  const index = abuseRecords.findIndex((item) => item.userId === userId);
  const currentRecord = index >= 0 ? abuseRecords[index] : { userId, events: [] };
  const blockedUntil = currentRecord.blockedUntil ? new Date(currentRecord.blockedUntil).getTime() : 0;

  if (blockedUntil > now) {
    safeWriteAbuseRecords(abuseRecords.slice(-1000));

    return {
      allowed: false,
      reason: "temporary_block",
      blockedUntil: currentRecord.blockedUntil,
    };
  }

  const recentEvents = Array.isArray(currentRecord.events)
    ? currentRecord.events.filter((event) => now - Number(event.at || 0) <= ABUSE_LONG_WINDOW_MS)
    : [];

  recentEvents.push({
    at: now,
    textFingerprint: getTextFingerprint(normalizedText),
  });

  const shortWindowCount = recentEvents.filter((event) => now - Number(event.at || 0) <= ABUSE_SHORT_WINDOW_MS).length;
  const longWindowCount = recentEvents.length;
  const textFingerprint = getTextFingerprint(normalizedText);
  const repeatedTextCount = recentEvents.filter((event) =>
    event.textFingerprint === textFingerprint && now - Number(event.at || 0) <= ABUSE_SHORT_WINDOW_MS
  ).length;

  const nextRecord = {
    userId,
    events: recentEvents,
    blockedUntil: "",
    updatedAt: new Date(now).toISOString(),
  };

  let result = { allowed: true, reason: "allowed" };

  if (longWindowCount > ABUSE_BLOCK_THRESHOLD) {
    nextRecord.blockedUntil = new Date(now + ABUSE_BLOCK_DURATION_MS).toISOString();
    result = {
      allowed: false,
      reason: "temporary_block",
      blockedUntil: nextRecord.blockedUntil,
    };
  } else if (shortWindowCount > ABUSE_COOLDOWN_THRESHOLD) {
    result = {
      allowed: false,
      reason: "cooldown",
    };
  } else if (repeatedTextCount > REPEATED_TEXT_THRESHOLD) {
    result = {
      allowed: false,
      reason: "repeated_message",
    };
  }

  if (index >= 0) {
    abuseRecords[index] = nextRecord;
  } else {
    abuseRecords.push(nextRecord);
  }

  safeWriteAbuseRecords(abuseRecords.slice(-1000));

  if (!result.allowed) {
    console.warn("MESSAGE_RATE_LIMITED", JSON.stringify({
      userId: maskIdentifier(userId),
      reason: result.reason,
    }));
  }

  return result;
}

function scoreLead(session) {
  const intent = session.lastIntent || "DESCONOCIDO";
  const tags = new Set(Array.isArray(session.leadTags) ? session.leadTags : []);
  let score = 20;
  let priority = "BAJA";

  if (intent === "CITA" || intent === "APPOINTMENT_DATA") {
    score = 90;
    priority = "ALTA";
  } else if (intent === "EMPRESA") {
    score = 85;
    priority = "ALTA";
  } else if (intent === "PATRIMONIO_PROPIEDAD") {
    score = 75;
    priority = "MEDIA_ALTA";
  } else if (intent === "PATRIMONIO_AUTO") {
    score = 65;
    priority = "MEDIA";
  } else if (intent === "PATRIMONIO_GENERAL") {
    score = 70;
    priority = "MEDIA_ALTA";
  } else if (intent === "SALUD" || intent === "VIDA") {
    score = 65;
    priority = "MEDIA";
  } else if (intent === "FAMILIA") {
    score = 60;
    priority = "MEDIA";
  } else if (intent === "INFORMACION") {
    score = 45;
    priority = "MEDIA_BAJA";
  }

  if (intent === "PRECIO") {
    score = session.repeatedPrice ? 30 : 45;
    priority = session.repeatedPrice ? "BAJA" : "MEDIA_BAJA";

    if (session.repeatedPrice) {
      tags.add("posible_cazador_precio");
    }
  }

  return {
    score,
    priority,
    tags: Array.from(tags),
  };
}

function createLeadFromSession(session) {
  try {
    const now = new Date().toISOString();
    const leads = getLeads();
    const index = leads.findIndex((item) =>
      (session.userId && item.userId === session.userId) ||
      (session.phoneNumber && item.phoneNumber === session.phoneNumber)
    );
    const existingLead = index >= 0 ? leads[index] : null;
    const scoring = scoreLead(session);
    const lead = {
      ...(existingLead || {}),
      leadId: existingLead?.leadId || generateLeadId(),
      createdAt: existingLead?.createdAt || now,
      updatedAt: now,
      userId: session.userId || existingLead?.userId || "",
      phoneNumber: session.phoneNumber || existingLead?.phoneNumber || "",
      profileName: session.profileName || existingLead?.profileName || "",
      lastMessage: session.lastMessage || "",
      lastIntent: session.lastIntent || "DESCONOCIDO",
      riskCategory: session.riskCategory || session.lastIntent || "DESCONOCIDO",
      appointmentRequested: Boolean(session.appointmentRequested),
      appointmentName: session.appointmentName || existingLead?.appointmentName || "",
      appointmentDay: session.appointmentDay || existingLead?.appointmentDay || "",
      appointmentTime: session.appointmentTime || existingLead?.appointmentTime || "",
      priority: scoring.priority,
      score: scoring.score,
      tags: scoring.tags,
      status: existingLead?.status || "NUEVO",
    };

    if (index >= 0) {
      leads[index] = lead;
      console.log("LEAD_UPDATED", JSON.stringify({ userId: maskIdentifier(lead.userId), phoneNumber: maskIdentifier(lead.phoneNumber) }));
    } else {
      leads.push(lead);
      console.log("LEAD_CREATED", JSON.stringify({ userId: maskIdentifier(lead.userId), phoneNumber: maskIdentifier(lead.phoneNumber) }));
    }

    console.log("LEAD_SCORED", JSON.stringify({
      userId: maskIdentifier(lead.userId),
      lastIntent: lead.lastIntent,
      score: lead.score,
      priority: lead.priority,
      tags: lead.tags,
    }));

    writeJsonArray(leadsFile, leads);
console.log("GOOGLE_SHEETS_CALLING", JSON.stringify({ userId: maskIdentifier(lead.userId), lastIntent: lead.lastIntent }));
sendLeadToGoogleSheets(lead);
return lead;
  } catch (error) {
    console.error("LEAD_SAVE_ERROR", JSON.stringify({
      userId: maskIdentifier(session?.userId || ""),
      phoneNumber: maskIdentifier(session?.phoneNumber || ""),
      message: error.message,
    }));
    return null;
  }
}

function buildHumanHandoffSummary(session) {
  return {
    reason: "Usuario solicito analisis real escribiendo ANALIZAR",
    location: session.answers?.ubicacion || "",
    squareMeters: session.answers?.metrosCuadrados || "",
    constructionType: session.answers?.tipoConstruccion || "",
    estimatedRiskValue: session.lastEstimate ? session.lastEstimate.estimatedValue : null,
    nextAction: "Contactar para validacion humana y analisis de caso real",
  };
}

module.exports = {
  ensureDataFiles,
  getSessions,
  getLeads,
  getProcessedMessages,
  getSessionByUserId,
  upsertSession,
  hasProcessedMessageId,
  markProcessedMessageId,
  evaluateMessageAbuse,
  createLeadFromSession,
};
