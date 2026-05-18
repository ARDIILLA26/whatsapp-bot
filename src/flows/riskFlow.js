const { upsertSession, createLeadFromSession } = require("../services/storageService");
const { RESPONSES, CONTINUATION_BY_INTENT } = require("./risk/responses");
const { KEYWORDS } = require("./risk/keywords");
const { INTENT_PRIORITY } = require("./risk/priorities");
const { extractAppointmentData, buildAppointmentDataResponse, buildAppointmentTopicCompletionResponse, shouldExitAppointmentData, shouldAlwaysExitAppointmentData, looksLikeAppointmentData } = require("./risk/appointment");
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
  const trimmedText = normalizedText.trim();

  if (KEYWORDS.SALUDO.includes(trimmedText)) {
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

function isHealthAcceptanceQuestion(normalizedText) {
  return [
    "me van a aceptar",
    "me van aceptar",
    "me pueden aceptar",
    "me aceptan",
    "me acepta",
    "me aceptarian",
    "me pueden rechazar",
    "me van a rechazar",
    "me van rechazar",
    "me rechazan",
    "me rechaza",
    "me rechazarian",
    "me cubren preexistencias",
    "me cubre preexistencias",
    "cubren preexistencias",
    "cubre preexistencias",
    "me cubren enfermedades",
    "me cubre enfermedades",
    "me excluyen enfermedades",
    "me excluyen una enfermedad",
    "me pueden excluir",
    "me van a excluir",
    "aceptan con enfermedad",
    "aceptan con enfermedades",
    "aceptan con padecimiento",
    "aceptan con padecimientos",
    "si tengo enfermedad me aceptan",
    "si tengo enfermedades me aceptan",
    "si tengo padecimiento me aceptan",
    "si tengo padecimientos me aceptan",
  ].some((phrase) => normalizedText.includes(phrase));
}

function isHealthPriorCondition(normalizedText) {
  return [
    "preexistencia",
    "padecimiento previo",
    "padecimientos previos",
    "diabetes",
    "hipertension",
    "presion alta",
    "tiroides",
    "hipotiroidismo",
    "enfermedad previa",
    "enfermedad preexistente",
  ].some((phrase) => normalizedText.includes(phrase));
}

function isHealthPolicyReview(normalizedText) {
  return [
    "ya tengo poliza",
    "tengo poliza",
    "poliza vigente",
    "ya tengo seguro",
    "renovacion",
    "renovar",
    "exclusion",
    "excluir",
    "reclamacion",
    "ajuste",
  ].some((phrase) => normalizedText.includes(phrase));
}

function isGenericHealthInsuranceFollowup(normalizedText) {
  return [
    "gastos medicos",
    "seguro medico",
    "seguro de gastos medicos",
    "seguro de salud",
  ].some((phrase) => normalizedText === phrase || normalizedText.includes(phrase));
}

function isAwaitingAppointmentTopic(session) {
  return Boolean(
    session?.appointmentName &&
    (session?.appointmentDay || session?.appointmentTime) &&
    isAppointmentReadyNeedTopicResponse(session?.lastResponse)
  );
}

function isAppointmentReadyNeedTopicResponse(response) {
  return String(response || "").includes("Antes de confirmarlo");
}

function resolveResponse(intent, normalizedText, session) {
  const now = Date.now();
  const previousIntent = session?.lastIntent;
  const hasHealthContext = previousIntent === "SALUD";
  const repeatedText = isRecentExactRepeat(session, normalizedText, now);

  if ((intent === "SALUD" || intent === "INFORMACION" || hasHealthContext) && isHealthPolicyReview(normalizedText)) {
    return RESPONSES.SALUD_POLIZA_VIGENTE;
  }

  if ((intent === "SALUD" || (hasHealthContext && intent === "DESCONOCIDO")) && isHealthAcceptanceQuestion(normalizedText)) {
    return RESPONSES.SALUD_ACEPTACION;
  }

  if (intent === "SALUD" && isHealthPriorCondition(normalizedText)) {
    return RESPONSES.SALUD_CONTINUACION;
  }

  if (hasHealthContext && intent === "DESCONOCIDO" && isGenericHealthInsuranceFollowup(normalizedText)) {
    return RESPONSES.SALUD_CONTINUACION;
  }

  if (repeatedText && previousIntent) {
    return CONTINUATION_BY_INTENT[previousIntent] || RESPONSES.DESCONOCIDO;
  }

  if (previousIntent === intent) {
    return CONTINUATION_BY_INTENT[intent] || RESPONSES.DESCONOCIDO;
  }

  return RESPONSES[intent] || RESPONSES.DESCONOCIDO;
}

function isSafeAppointmentNameOnly(normalizedText, appointmentData) {
  if (!appointmentData.likelyName) {
    return false;
  }

  return /^(me llamo|mi nombre es|habla con|soy)\s+[a-z]+(?:\s+[a-z]+){0,2}(?:\s+(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+([01]?\d|2[0-3])(?::([0-5]\d))?)?)?$/.test(normalizedText) ||
    /^[a-z]+(?:\s+[a-z]+){0,2}$/.test(normalizedText);
}

function isSafeAppointmentDataInFlow(normalizedText, appointmentData) {
  if (includesAny(normalizedText, KEYWORDS.PIRATEO_SISTEMA)) {
    return false;
  }

  if (isSafeAppointmentNameOnly(normalizedText, appointmentData)) {
    return true;
  }

  if (!appointmentData.likelyName || !appointmentData.hour) {
    return false;
  }

  return /^(me llamo|mi nombre es|habla con|soy)\s+[a-z]+(?:\s+[a-z]+){0,2}\s+([01]?\d|2[0-3])(?::([0-5]\d))?$/.test(normalizedText);
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
    const effectiveIntent = overridingIntent === "PIRATEO_SISTEMA" && isSafeAppointmentDataInFlow(normalizedText, appointmentData)
      ? "APPOINTMENT_DATA"
      : overridingIntent;
    const hasCompleteIncomingAppointmentData = Boolean(appointmentData.likelyName && appointmentData.schedule);

    if (isAwaitingAppointmentTopic(activeSession) && !shouldAlwaysExitAppointmentData(effectiveIntent)) {
      const appointmentTopicResponse = buildAppointmentTopicCompletionResponse(incomingText, activeSession);

      if (appointmentTopicResponse) {
        activeSession.awaiting = null;
        activeSession.riskCategory = "CITA";

        updateSessionMemory(activeSession, incomingText, normalizedText, "APPOINTMENT_DATA", appointmentTopicResponse, null);

        return {
          replies: [appointmentTopicResponse],
          session: activeSession,
        };
      }
    }

    if (effectiveIntent === "DESCONOCIDO" && !looksLikeAppointmentData(appointmentData)) {
      const response = resolveResponse(effectiveIntent, normalizedText, { ...activeSession, awaiting: null });

      activeSession.awaiting = null;
      activeSession.riskCategory = effectiveIntent;

      updateSessionMemory(activeSession, incomingText, normalizedText, effectiveIntent, response, null);

      return {
        replies: [response],
        session: activeSession,
      };
    }

    if (shouldExitAppointmentData(effectiveIntent) && (shouldAlwaysExitAppointmentData(effectiveIntent) || !hasCompleteIncomingAppointmentData)) {
      const response = resolveResponse(effectiveIntent, normalizedText, { ...activeSession, awaiting: null });

      activeSession.awaiting = null;
      activeSession.riskCategory = effectiveIntent;

      updateSessionMemory(activeSession, incomingText, normalizedText, effectiveIntent, response, null);

      return {
        replies: [response],
        session: activeSession,
      };
    }

    const response = buildAppointmentDataResponse(incomingText, activeSession);
    const hasName = Boolean(appointmentData.likelyName || activeSession.appointmentName);
    const hasSchedule = Boolean(appointmentData.schedule || activeSession.appointmentDay || activeSession.appointmentTime);
    const needsMoreAppointmentData = !hasName || !hasSchedule || response === RESPONSES.APPOINTMENT_FLEXIBLE || response === RESPONSES.APPOINTMENT_NEED_DAY || isAppointmentReadyNeedTopicResponse(response);

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

  const rawIntent = classifyMessage(incomingText);
  const appointmentData = extractAppointmentData(incomingText);
  const intent = rawIntent === "PIRATEO_SISTEMA" && isSafeAppointmentDataInFlow(normalizedText, appointmentData)
    ? "APPOINTMENT_DATA"
    : rawIntent;
  const hasAppointmentData = looksLikeAppointmentData(appointmentData);
  const hasCompleteIncomingAppointmentData = Boolean(appointmentData.likelyName && appointmentData.schedule);

  if (hasAppointmentData && (!shouldExitAppointmentData(intent) || (hasCompleteIncomingAppointmentData && !shouldAlwaysExitAppointmentData(intent)))) {
    const response = buildAppointmentDataResponse(incomingText, activeSession);
    const needsMoreAppointmentData = !appointmentData.likelyName || !appointmentData.schedule || response === RESPONSES.APPOINTMENT_FLEXIBLE || response === RESPONSES.APPOINTMENT_NEED_DAY || isAppointmentReadyNeedTopicResponse(response);

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
