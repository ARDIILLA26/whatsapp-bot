const { RESPONSES } = require("./responses");
const { KEYWORDS, NON_NAME_WORDS } = require("./keywords");
const { isSecurityIntent } = require("./security");
const { normalizeText, capitalizeWord, includesAny } = require("./textUtils");

const DAY_LABELS = {
  manana: "mañana",
  "pasado manana": "pasado mañana",
  miercoles: "miércoles",
  sabado: "sábado",
};
const DAY_WORDS = new Set(["hoy", "manana", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]);

function extractAppointmentData(text) {
  const rawText = String(text || "").trim();
  const normalizedText = normalizeText(rawText);
  const words = rawText.split(/\s+/).filter(Boolean);
  const firstWord = (words[0] || "").replace(/[,\.\s]/g, "");
  const normalizedFirstWord = normalizeText(firstWord);
  const statedNameMatch = normalizedText.includes("soy de ")
    ? null
    : rawText.match(/\b(?:soy|me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/i);
  const statedName = statedNameMatch ? statedNameMatch[1] : "";
  const normalizedStatedName = normalizeText(statedName);
  const likelyName = statedName && !NON_NAME_WORDS.has(normalizedStatedName)
    ? capitalizeWord(statedName)
    : /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(firstWord) &&
      !NON_NAME_WORDS.has(normalizedFirstWord) &&
      !DAY_WORDS.has(normalizedFirstWord)
      ? capitalizeWord(firstWord)
      : "";
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
    return "vehículo";
  }
  if (includesAny(normalizedText, KEYWORDS.EMPRESA)) {
    return "empresa";
  }
  if (includesAny(normalizedText, KEYWORDS.SALUD)) {
    return "gastos médicos";
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

  return `Bien, ${finalName}.\n${preference}\nTe contactaremos para confirmar la revisión.`;
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

module.exports = {
  extractAppointmentData,
  buildAppointmentDataResponse,
  shouldExitAppointmentData,
  shouldAlwaysExitAppointmentData,
};
