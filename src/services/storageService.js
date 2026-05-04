const fs = require("fs");
const path = require("path");
const { generateLeadId } = require("../utils/helpers");
const { sendLeadToGoogleSheets } = require("./googleSheetsService");
const dataDir = path.join(__dirname, "..", "data");
const sessionsFile = path.join(dataDir, "sessions.json");
const leadsFile = path.join(dataDir, "leads.json");
const processedMessagesFile = path.join(dataDir, "processedMessages.json");
const maxProcessedMessages = 1000;

function ensureDataFiles() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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
      console.log("LEAD_UPDATED", JSON.stringify({ userId: lead.userId, phoneNumber: lead.phoneNumber }));
    } else {
      leads.push(lead);
      console.log("LEAD_CREATED", JSON.stringify({ userId: lead.userId, phoneNumber: lead.phoneNumber }));
    }

    console.log("LEAD_SCORED", JSON.stringify({
      userId: lead.userId,
      lastIntent: lead.lastIntent,
      score: lead.score,
      priority: lead.priority,
      tags: lead.tags,
    }));

    writeJsonArray(leadsFile, leads);
console.log("GOOGLE_SHEETS_CALLING", JSON.stringify({ userId: lead.userId, lastIntent: lead.lastIntent }));
sendLeadToGoogleSheets(lead);
return lead;
  } catch (error) {
    console.error("LEAD_SAVE_ERROR", JSON.stringify({
      userId: session?.userId || "",
      phoneNumber: session?.phoneNumber || "",
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
  createLeadFromSession,
};
