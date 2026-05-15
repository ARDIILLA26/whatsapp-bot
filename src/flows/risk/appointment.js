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

function extractStatedName(rawText, normalizedText) {
  if (normalizedText.includes("soy de ")) {
    return "";
  }

  const statedNameMatch = rawText.match(/\b(?:me llamo|mi nombre es|habla con|soy(?:\s+(?:el|la))?)\s+([A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1]+(?:\s+[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1]+){0,2})\b/i);

  return parseNameCandidate(statedNameMatch ? statedNameMatch[1] : "");
}

function extractStandaloneName(rawText, normalizedText) {
  if (hasQuestionSignal(rawText, normalizedText)) {
    return "";
  }

  const normalizedWords = rawText
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => normalizeText(word.replace(/[,\.\s]/g, "")));

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

function buildAppointmentDataResponse(text, session = {}) {
  const normalizedText = normalizeText(text);

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

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_FLEXIBLE)) {
    return RESPONSES.APPOINTMENT_FLEXIBLE;
  }

  const { likelyName, day, hour, schedule, topic } = extractAppointmentData(text);
  const finalName = likelyName || session.appointmentName || "";

  if (hour && !day) {
    return RESPONSES.APPOINTMENT_NEED_DAY;
  }

  if (!finalName && !schedule) {
    return RESPONSES.APPOINTMENT_DATA;
  }

  if (finalName && !schedule) {
    return RESPONSES.APPOINTMENT_NEED_TIME.replace("{name}", finalName);
  }

  if (!finalName && schedule) {
    return RESPONSES.APPOINTMENT_NEED_NAME.replace("{schedule}", schedule);
  }

  const preference = topic
    ? `Registro tu preferencia para ${schedule}, sobre ${topic}.`
    : `Registro tu preferencia para ${schedule}.`;

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
  shouldExitAppointmentData,
  shouldAlwaysExitAppointmentData,
  looksLikeAppointmentData,
};
