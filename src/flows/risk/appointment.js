const { RESPONSES } = require("./responses");
const { KEYWORDS, NON_NAME_WORDS } = require("./keywords");
const { isSecurityIntent } = require("./security");
const { normalizeText, capitalizeWord, includesAny } = require("./textUtils");

const DAY_LABELS = {
  manana: "ma\u00f1ana",
  "pasado manana": "pasado ma\u00f1ana",
  miercoles: "mi\u00e9rcoles",
  sabado: "s\u00e1bado",
};
const DAY_WORDS = new Set(["hoy", "manana", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]);
const NAME_BLOCK_WORDS = new Set([
  "autopista",
  "auto",
  "busco",
  "carretera",
  "cita",
  "costo",
  "crm",
  "danos",
  "dame",
  "dime",
  "dueno",
  "empresa",
  "eso",
  "hablame",
  "horario",
  "llamada",
  "llamame",
  "marcame",
  "mas",
  "necesito",
  "obra",
  "precio",
  "prompt",
  "quiero",
  "rato",
  "responsabilidad",
  "salud",
  "scoring",
  "seguro",
  "solo",
  "tarde",
  "te",
  "terceros",
  "tu",
  "veo",
]);
const NAME_BLOCK_CONNECTORS = new Set(["o", "por", "para", "de", "en"]);
const NAME_WORD_PATTERN = /^[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1]+$/;

function formatName(words) {
  return words.map((word) => capitalizeWord(word)).join(" ");
}

function hasQuestionSignal(rawText, normalizedText) {
  return /[?\u00bf]/.test(rawText) || /^(que|cual|cuanto|como|cuando|donde|por que|para que|quien)\b/.test(normalizedText);
}

function isBlockedNameWord(word) {
  const normalizedWord = normalizeText(word);

  return NON_NAME_WORDS.has(normalizedWord) || DAY_WORDS.has(normalizedWord) || NAME_BLOCK_WORDS.has(normalizedWord);
}

function parseNameCandidate(candidate) {
  const words = String(candidate || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[,\.\s]/g, ""));

  if (!words.length || words.length > 3) {
    return "";
  }

  if (!words.every((word) => NAME_WORD_PATTERN.test(word))) {
    return "";
  }

  if (words.some((word) => isBlockedNameWord(word))) {
    return "";
  }

  return formatName(words);
}

function parseNameBeforeSchedule(candidate) {
  const words = String(candidate || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const scheduleIndex = words.findIndex((word) => {
    const cleanWord = word.replace(/[,\.\s]/g, "");
    const normalizedWord = normalizeText(cleanWord);

    return DAY_WORDS.has(normalizedWord) || /^([01]?\d|2[0-3])(?::([0-5]\d))?$/.test(cleanWord);
  });

  if (scheduleIndex <= 0) {
    return "";
  }

  return parseNameCandidate(words.slice(0, scheduleIndex).join(" "));
}

function extractStatedName(rawText, normalizedText) {
  if (normalizedText.includes("soy de ")) {
    return "";
  }

  const statedNameMatch = rawText.match(/\b(?:me llamo|mi nombre es|habla con|soy(?:\s+(?:el|la))?)\s+(.+)$/i);
  const candidate = statedNameMatch ? statedNameMatch[1] : "";

  return parseNameBeforeSchedule(candidate) || parseNameCandidate(candidate);
}

function extractStandaloneName(rawText, normalizedText) {
  if (hasQuestionSignal(rawText, normalizedText)) {
    return "";
  }

  const normalizedWords = rawText
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => normalizeText(word.replace(/[,\.\s]/g, "")));
  const compactName = parseNameBeforeSchedule(rawText);

  if (compactName) {
    return compactName;
  }

  if (normalizedWords.some((word) => NAME_BLOCK_CONNECTORS.has(word))) {
    return "";
  }

  return parseNameCandidate(rawText);
}

function extractAppointmentData(text) {
  const rawText = String(text || "").trim();
  const normalizedText = normalizeText(rawText);
  const likelyName = extractStatedName(rawText, normalizedText) || extractStandaloneName(rawText, normalizedText);
  const dayMatch = normalizedText.match(/\b(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  const rangeMatch = normalizedText.match(/\b(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(?:por|en|a)\s+la\s+(manana|tarde|noche)\b/);
  const timeMatch = normalizedText.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/);
  const standalonePeriodMatch = normalizedText.match(/\b(manana|tarde|noche)\b/);
  const day = dayMatch ? DAY_LABELS[dayMatch[0]] || dayMatch[0] : "";
  const hour = timeMatch ? formatHour(timeMatch[1], timeMatch[2], timeMatch[3], rangeMatch ? rangeMatch[2] : standalonePeriodMatch?.[1] || "") : "";
  const period = rangeMatch ? rangeMatch[2] : "";
  const schedule = formatSchedule(day, hour, period);
  const topic = resolveAppointmentTopic(normalizedText);

  return { likelyName, day, hour, period, schedule, topic };
}

function formatHour(hourText, minuteText = "", meridiem = "", period = "") {
  const hour = Number(hourText);
  const minutes = minuteText || "00";
  const suffix = meridiem === "pm" || period === "tarde" || period === "noche"
    ? " de la tarde"
    : "";

  return `${hour}:${minutes}${suffix}`;
}

function formatSchedule(day, hour, period) {
  if (day && hour) {
    return `${day} a las ${hour}`;
  }

  if (day && period) {
    return `${day} en la ${period}`;
  }

  if (day) {
    return day;
  }

  if (hour) {
    return `a las ${hour}`;
  }

  return "";
}

function formatStoredSchedule(session = {}) {
  const day = session.appointmentDay || "";
  const time = session.appointmentTime || "";
  const normalizedTime = normalizeText(time);

  if (day && ["manana", "tarde", "noche"].includes(normalizedTime)) {
    return `${day} en la ${time}`;
  }

  if (day && time) {
    return `${day} a las ${time}`;
  }

  if (time) {
    return ["manana", "tarde", "noche"].includes(normalizedTime) ? time : `a las ${time}`;
  }

  return day || time;
}

function resolveAppointmentTopic(normalizedText) {
  if (includesAny(normalizedText, KEYWORDS.FLOTILLA)) {
    return "flotilla";
  }
  if (includesAny(normalizedText, KEYWORDS.PATRIMONIO_GENERAL) || includesAny(normalizedText, KEYWORDS.PATRIMONIO_PROPIEDAD)) {
    return "patrimonio";
  }
  if (includesAny(normalizedText, KEYWORDS.PATRIMONIO_AUTO)) {
    return "veh\u00edculo";
  }
  if (includesAny(normalizedText, KEYWORDS.EMPRESA)) {
    return "empresa";
  }
  if (includesAny(normalizedText, KEYWORDS.SALUD)) {
    return "gastos m\u00e9dicos";
  }
  if (includesAny(normalizedText, KEYWORDS.VIDA)) {
    return "vida";
  }

  return "";
}

function buildAppointmentTopicCompletionResponse(text, session = {}) {
  const { topic } = extractAppointmentData(text);
  const finalName = session.appointmentName || "";
  const schedule = formatStoredSchedule(session);

  if (!topic || !finalName || !schedule) {
    return "";
  }

  return RESPONSES.APPOINTMENT_READY_COMPLETE
    .replace("{name}", finalName)
    .replace("{schedule}", schedule)
    .replace("{topic}", topic);
}

function buildAppointmentDataResponse(text, session = {}) {
  const normalizedText = normalizeText(text);
  const { likelyName, day, hour, schedule, topic } = extractAppointmentData(text);
  const finalName = likelyName || session.appointmentName || "";
  const finalDay = day || session.appointmentDay || "";
  const finalHour = hour || session.appointmentTime || "";
  const finalSchedule = formatStoredSchedule({
    appointmentDay: finalDay,
    appointmentTime: finalHour,
  }) || schedule;
  const knownTopic = topic || (
    session.riskCategory &&
    !["CITA", "APPOINTMENT_DATA", "DESCONOCIDO", "SALUDO"].includes(session.riskCategory)
  );

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_DURATION)) {
    return RESPONSES.APPOINTMENT_DURATION;
  }

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_COST)) {
    return RESPONSES.APPOINTMENT_COST;
  }

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_URGENT)) {
    return RESPONSES.APPOINTMENT_URGENT;
  }

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_TODAY)) {
    return RESPONSES.APPOINTMENT_TODAY;
  }

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_LINK)) {
    return RESPONSES.APPOINTMENT_LINK;
  }

  if (finalName && finalHour && !finalDay) {
    return RESPONSES.APPOINTMENT_NEED_DAY;
  }

  if (finalName && finalSchedule) {
    if (knownTopic) {
      return RESPONSES.APPOINTMENT_READY_WITH_TOPIC
        .replace("{name}", finalName)
        .replace("{schedule}", finalSchedule);
    }

    return RESPONSES.APPOINTMENT_READY_NEED_TOPIC
      .replace("{name}", finalName)
      .replace("{schedule}", finalSchedule);
  }

  if (!finalName && finalSchedule) {
    return RESPONSES.APPOINTMENT_NEED_NAME.replace("{schedule}", finalSchedule);
  }

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_FLEXIBLE)) {
    return RESPONSES.APPOINTMENT_FLEXIBLE;
  }

  if (hour && !day) {
    return RESPONSES.APPOINTMENT_NEED_DAY;
  }

  if (!finalName && !finalSchedule) {
    return RESPONSES.APPOINTMENT_DATA;
  }

  if (finalName && !finalSchedule) {
    return RESPONSES.APPOINTMENT_NEED_TIME.replace("{name}", finalName);
  }

  const preference = topic
    ? `Registro tu preferencia para ${finalSchedule}, sobre ${topic}.`
    : `Registro tu preferencia para ${finalSchedule}.`;

  return `Bien, ${finalName}.\n${preference}\nTe contactaremos para confirmar la revisi\u00f3n.`;
}

function shouldExitAppointmentData(intent) {
  return [
    ...(isSecurityIntent(intent) ? [intent] : []),
    "INSULTO",
    "AGRESIVO",
    "PRECIO",
    "COTIZACION_INMEDIATA",
    "FLOTILLA",
    "EMPRESA",
    "PATRIMONIO_GENERAL",
    "PATRIMONIO_AUTO",
    "PATRIMONIO_PROPIEDAD",
    "SALUD",
    "VIDA",
    "INFORMACION",
    "CURIOSO_BAJO",
    "EVASIVO",
    "SALIDA_ELEGANTE",
    "SALUDO",
    "REGION_NORTE",
    "REGION_BAJIO",
    "REGION_CENTRO",
    "REGION_SURESTE",
  ].includes(intent);
}

function shouldAlwaysExitAppointmentData(intent) {
  return [
    ...(isSecurityIntent(intent) ? [intent] : []),
    "INSULTO",
    "AGRESIVO",
    "PRECIO",
    "COTIZACION_INMEDIATA",
    "EVASIVO",
    "SALIDA_ELEGANTE",
  ].includes(intent);
}

function looksLikeAppointmentData(appointmentData = {}) {
  return Boolean(appointmentData.likelyName || appointmentData.schedule);
}

module.exports = {
  extractAppointmentData,
  buildAppointmentDataResponse,
  buildAppointmentTopicCompletionResponse,
  shouldExitAppointmentData,
  shouldAlwaysExitAppointmentData,
  looksLikeAppointmentData,
};
