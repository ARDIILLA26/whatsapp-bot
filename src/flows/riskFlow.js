const { upsertSession, createLeadFromSession } = require("../services/storageService");
const { RESPONSES, CONTINUATION_BY_INTENT } = require("./risk/responses");
const { KEYWORDS } = require("./risk/keywords");
const { INTENT_PRIORITY } = require("./risk/priorities");
const { extractAppointmentData, buildAppointmentDataResponse, shouldExitAppointmentData, shouldAlwaysExitAppointmentData } = require("./risk/appointment");
const { normalizeText, includesAny } = require("./risk/textUtils");

const MEMORY_WINDOW_MS = 5 * 60 * 1000;

function createSession(user, session) {
  return session || {
    userId: user?.userId || "",
    phoneNumber: user?.phoneNumber || "",
    profileName: user?.profileName || "",
  };
}

function classifyMessage(text) {
  const normalizedText = normalizeText(text);

  if (KEYWORDS.SALUDO.includes(normalizedText.trim())) {
    return "SALUDO";
  }

  for (const intent of INTENT_PRIORITY) {
    if (includesAny(normalizedText, KEYWORDS[intent])) {
      return intent;
    }
  }

  return "DESCONOCIDO";
}

function isRecentExactRepeat(session, normalizedText, now) {
  if (!session?.lastIncomingText || !session?.lastIncomingAt) {
    return false;
  }

  return (
    session.lastIncomingText === normalizedText &&
    now - new Date(session.lastIncomingAt).getTime() < MEMORY_WINDOW_MS
  );
}

function resolveResponse(intent, normalizedText, session) {
  const now = Date.now();
  const previousIntent = session?.lastIntent;
  const repeatedText = isRecentExactRepeat(session, normalizedText, now);

  if (repeatedText && previousIntent) {
    return CONTINUATION_BY_INTENT[previousIntent] || RESPONSES.DESCONOCIDO;
  }

  if (previousIntent === intent) {
    return CONTINUATION_BY_INTENT[intent] || RESPONSES.DESCONOCIDO;
  }

  return RESPONSES[intent] || RESPONSES.DESCONOCIDO;
}

function updateSessionMemory(session, incomingText, normalizedText, intent, response, awaiting = null) {
  const now = new Date().toISOString();

  session.lastIntent = intent;
  session.lastMessage = String(incomingText || "").trim();
  session.lastIncomingText = normalizedText;
  session.lastResponse = response;
  session.lastIncomingAt = now;
  session.updatedAt = now;
  session.awaiting = awaiting;

  upsertSession(session);
  createLeadFromSession(session);
}

async function handleIncomingText(user, incomingText, session) {
  const activeSession = createSession(user, session);
  const normalizedText = normalizeText(incomingText);

  if (!normalizedText) {
    return {
      replies: [],
      session: activeSession,
    };
  }

  if (activeSession.awaiting === "APPOINTMENT_DATA") {
    const overridingIntent = classifyMessage(incomingText);
    const appointmentData = extractAppointmentData(incomingText);
    const hasCompleteIncomingAppointmentData = Boolean(appointmentData.likelyName && appointmentData.schedule);

    if (shouldExitAppointmentData(overridingIntent) && (shouldAlwaysExitAppointmentData(overridingIntent) || !hasCompleteIncomingAppointmentData)) {
      const response = resolveResponse(overridingIntent, normalizedText, { ...activeSession, awaiting: null });

      activeSession.awaiting = null;
      activeSession.riskCategory = overridingIntent;

      updateSessionMemory(activeSession, incomingText, normalizedText, overridingIntent, response, null);

      return {
        replies: [response],
        session: activeSession,
      };
    }

    const response = buildAppointmentDataResponse(incomingText, activeSession);
    const hasName = Boolean(appointmentData.likelyName || activeSession.appointmentName);
    const hasSchedule = Boolean(appointmentData.schedule || activeSession.appointmentDay || activeSession.appointmentTime);
    const needsMoreAppointmentData = !hasName || !hasSchedule || response === RESPONSES.APPOINTMENT_FLEXIBLE || response === RESPONSES.APPOINTMENT_NEED_DAY;

    activeSession.appointmentRequested = true;
    activeSession.appointmentName = appointmentData.likelyName || activeSession.appointmentName || "";
    activeSession.appointmentDay = appointmentData.day || activeSession.appointmentDay || "";
    activeSession.appointmentTime = appointmentData.hour || appointmentData.period || activeSession.appointmentTime || "";
    activeSession.riskCategory = "CITA";

    updateSessionMemory(activeSession, incomingText, normalizedText, "APPOINTMENT_DATA", response, needsMoreAppointmentData ? "APPOINTMENT_DATA" : null);

    return {
      replies: [response],
      session: activeSession,
    };
  }

  const intent = classifyMessage(incomingText);
  const appointmentData = extractAppointmentData(incomingText);
  const looksLikeAppointmentData = Boolean(appointmentData.likelyName || appointmentData.schedule);
  const hasCompleteIncomingAppointmentData = Boolean(appointmentData.likelyName && appointmentData.schedule);

  if (looksLikeAppointmentData && (!shouldExitAppointmentData(intent) || (hasCompleteIncomingAppointmentData && !shouldAlwaysExitAppointmentData(intent)))) {
    const response = buildAppointmentDataResponse(incomingText, activeSession);
    const needsMoreAppointmentData = !appointmentData.likelyName || !appointmentData.schedule || response === RESPONSES.APPOINTMENT_FLEXIBLE || response === RESPONSES.APPOINTMENT_NEED_DAY;

    activeSession.appointmentRequested = true;
    activeSession.appointmentName = appointmentData.likelyName || activeSession.appointmentName || "";
    activeSession.appointmentDay = appointmentData.day || activeSession.appointmentDay || "";
    activeSession.appointmentTime = appointmentData.hour || appointmentData.period || activeSession.appointmentTime || "";
    activeSession.riskCategory = "CITA";

    updateSessionMemory(activeSession, incomingText, normalizedText, "APPOINTMENT_DATA", response, needsMoreAppointmentData ? "APPOINTMENT_DATA" : null);

    return {
      replies: [response],
      session: activeSession,
    };
  }

  const response = resolveResponse(intent, normalizedText, activeSession);
  const awaiting = intent === "CITA" || intent.startsWith("APPOINTMENT_") ? "APPOINTMENT_DATA" : null;
  const priceMentionCount = intent === "PRECIO"
    ? Number(activeSession.priceMentionCount || 0) + 1
    : Number(activeSession.priceMentionCount || 0);

  activeSession.priceMentionCount = priceMentionCount;
  activeSession.repeatedPrice = intent === "PRECIO" && priceMentionCount > 1;

  if (awaiting === "APPOINTMENT_DATA") {
    activeSession.appointmentRequested = true;
  }

  activeSession.riskCategory = intent === "CITA" ? "CITA" : intent;

  updateSessionMemory(activeSession, incomingText, normalizedText, intent, response, awaiting);

  return {
    replies: [response],
    session: activeSession,
  };
}

module.exports = {
  handleIncomingText,
};
