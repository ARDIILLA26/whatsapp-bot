const fs = require("fs");
const path = require("path");
const { generateLeadId } = require("../utils/helpers");

const dataDir = path.join(__dirname, "..", "data");
const sessionsFile = path.join(dataDir, "sessions.json");
const leadsFile = path.join(dataDir, "leads.json");

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

function createLeadFromSession(session) {
  const leads = getLeads();
  const existingLead = leads.find((item) => item.userId === session.userId && item.isQualifiedLead);

  if (existingLead) {
    return existingLead;
  }

  const lead = {
    leadId: generateLeadId(),
    userId: session.userId,
    phoneNumber: session.phoneNumber,
    profileName: session.profileName,
    answers: session.answers,
    estimate: session.lastEstimate,
    isQualifiedLead: true,
    requiresHumanFollowUp: true,
    humanHandoffSummary: buildHumanHandoffSummary(session),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  leads.push(lead);
  writeJsonArray(leadsFile, leads);

  return lead;
}

function buildHumanHandoffSummary(session) {
  return {
    reason: "Usuario solicito analisis real escribiendo ANALIZAR",
    location: session.answers.ubicacion,
    squareMeters: session.answers.metrosCuadrados,
    constructionType: session.answers.tipoConstruccion,
    estimatedRiskValue: session.lastEstimate ? session.lastEstimate.estimatedValue : null,
    nextAction: "Contactar para validacion humana y analisis de caso real",
  };
}

module.exports = {
  ensureDataFiles,
  getSessions,
  getLeads,
  getSessionByUserId,
  upsertSession,
  createLeadFromSession,
};
