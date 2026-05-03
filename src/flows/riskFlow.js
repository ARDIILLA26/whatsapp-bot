const { upsertSession } = require("../services/storageService");

const RESPONSES = {
  SALUDO: "Cáceres & Casio, consultoría en riesgos.\nAquí primero entendemos el riesgo y luego se decide.\n¿Qué traes en mente?",
  PRECIO: "Claro, el precio es importante.\nPara orientarte bien, primero necesito entender qué quieres proteger.\n¿Qué situación te preocupa más?",
  PRECIO_CONTINUACION: "Te entiendo.\nPara darte una orientación útil, necesito ubicar primero la situación.\n¿Es algo personal, familiar, patrimonial o de empresa?",
  PATRIMONIO_PROPIEDAD: "Entiendo, hablamos de una propiedad.\n¿Es casa habitación, inmueble en renta o patrimonio familiar?",
  PATRIMONIO_PROPIEDAD_CONTINUACION: "Perfecto.\nEntonces conviene revisar qué impacto tendría ese inmueble si algo pasa.\n¿Quieres verlo 20 min y ordenamos la situación?",
  PATRIMONIO_AUTO: "Entiendo, hablamos de un vehículo.\n¿Te preocupa más daño, robo, responsabilidad o que deje de operar?",
  PATRIMONIO_AUTO_CONTINUACION: "Tiene sentido revisarlo.\nEn un vehículo, el riesgo no siempre está en el golpe; también está en el impacto económico.\n¿Lo vemos 20 min y lo ordenamos?",
  PATRIMONIO_GENERAL: "Claro.\nPara cuidar tu patrimonio, primero ubicamos qué parte necesita más atención.\n¿Te preocupa más una propiedad, un auto o tu estabilidad económica?",
  EMPRESA: "Perfecto.\nEn empresa conviene revisar operación, personas, activos y consecuencias.\n¿Qué parte te preocupa más hoy?",
  EMPRESA_CONTINUACION: "Tiene sentido revisarlo.\nAhí el riesgo no está solo en la póliza, sino en la operación.\n¿Lo vemos 20 min y lo ordenamos?",
  SALUD: "Claro.\nEn salud conviene revisar el impacto económico antes de decidir.\n¿La preocupación es por ti, tu familia o tu empresa?",
  SALUD_CONTINUACION: "Tiene sentido.\nAntes de hablar de una solución, conviene medir qué impacto económico tendría.\n¿Lo vemos 20 min y lo ordenamos?",
  VIDA: "Entiendo.\nEn vida conviene revisar quién depende de tu ingreso.\n¿Quién necesitaría mayor respaldo si algo llegara a pasar?",
  VIDA_CONTINUACION: "Tiene sentido.\nAquí no se trata de contratar algo rápido, sino de entender el impacto real.\n¿Lo vemos 20 min y lo ordenamos?",
  FAMILIA: "Entiendo.\nCuando se trata de familia, primero hay que ver qué quieres cuidar.\n¿Te preocupa más ingreso, salud o patrimonio?",
  FAMILIA_CONTINUACION: "Correcto.\nEntonces conviene ordenar el riesgo familiar antes de decidir.\n¿Lo vemos 20 min y lo aterrizamos?",
  INFORMACION: "Claro.\nPara no mandarte información genérica, primero necesito ubicar el tipo de riesgo.\n¿Es personal, familiar, patrimonial o de empresa?",
  CITA: "Perfecto.\nAgendamos una revisión de 20 min.\nCompárteme tu nombre y el horario que prefieres.",
  APPOINTMENT_DATA: "De acuerdo.\nRegistro tu preferencia para la revisión.\nTe contactaremos para confirmar horario.",
  DESCONOCIDO: "Para orientarte bien, necesito ubicar el riesgo.\n¿Hablamos de algo personal, familiar, patrimonial o de empresa?",
};

const CONTINUATION_BY_INTENT = {
  PRECIO: RESPONSES.PRECIO_CONTINUACION,
  PATRIMONIO_PROPIEDAD: RESPONSES.PATRIMONIO_PROPIEDAD_CONTINUACION,
  PATRIMONIO_AUTO: RESPONSES.PATRIMONIO_AUTO_CONTINUACION,
  EMPRESA: RESPONSES.EMPRESA_CONTINUACION,
  SALUD: RESPONSES.SALUD_CONTINUACION,
  VIDA: RESPONSES.VIDA_CONTINUACION,
  FAMILIA: RESPONSES.FAMILIA_CONTINUACION,
  PATRIMONIO_GENERAL: RESPONSES.DESCONOCIDO,
  INFORMACION: RESPONSES.DESCONOCIDO,
  SALUDO: RESPONSES.DESCONOCIDO,
  DESCONOCIDO: RESPONSES.DESCONOCIDO,
};

const KEYWORDS = {
  SALUDO: ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches"],
  PRECIO: ["precio", "cuesta", "costo", "cuanto", "cotizacion", "cotizar", "barato", "mensualidad", "pago"],
  PATRIMONIO_PROPIEDAD: ["casa", "propiedad", "inmueble", "departamento", "terreno", "edificio", "local", "bodega", "renta", "rentada", "hipotecada"],
  PATRIMONIO_AUTO: ["auto", "coche", "carro", "vehiculo", "camioneta", "flotilla", "moto", "transporte"],
  PATRIMONIO_GENERAL: ["patrimonio", "bienes", "estabilidad economica", "dinero", "ahorro", "inversion", "inversiones"],
  EMPRESA: ["empresa", "negocio", "empleados", "operacion", "operaciones", "oficina", "maquinaria", "inventario", "responsabilidad", "director", "socio", "pyme"],
  SALUD: ["salud", "hospital", "gastos medicos", "enfermedad", "accidente", "doctor", "clinica", "tratamiento"],
  VIDA: ["vida", "fallecimiento", "muerte", "ingreso", "depende de mi", "dependen de mi", "familia depende", "respaldo"],
  FAMILIA: ["familia", "hijos", "esposa", "esposo", "padres", "mama", "papa", "pareja"],
  INFORMACION: ["informacion", "informes", "solo quiero informacion", "quiero saber", "mandame informacion"],
  CITA: ["cita", "reunion", "llamada", "agenda", "agendar", "hablar", "asesoria", "consulta", "revision", "diagnostico"],
};

const INTENT_PRIORITY = [
  "CITA",
  "INFORMACION",
  "PRECIO",
  "PATRIMONIO_AUTO",
  "PATRIMONIO_PROPIEDAD",
  "EMPRESA",
  "SALUD",
  "VIDA",
  "FAMILIA",
  "PATRIMONIO_GENERAL",
  "SALUDO",
];

const MEMORY_WINDOW_MS = 5 * 60 * 1000;
const NON_NAME_WORDS = new Set(["ok", "okay", "si", "sí", "va", "sale", "gracias", "listo"]);
const DAY_LABELS = {
  manana: "mañana",
  "pasado manana": "pasado mañana",
  miercoles: "miércoles",
  sabado: "sábado",
};
const DAY_WORDS = new Set(["hoy", "manana", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]);

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function capitalizeWord(word) {
  if (!word) {
    return "";
  }

  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function createSession(user, session) {
  return session || {
    userId: user?.userId || "",
    phoneNumber: user?.phoneNumber || "",
    profileName: user?.profileName || "",
  };
}

function extractAppointmentData(text) {
  const rawText = String(text || "").trim();
  const normalizedText = normalizeText(rawText);
  const words = rawText.split(/\s+/).filter(Boolean);
  const firstWord = words[0] || "";
  const normalizedFirstWord = normalizeText(firstWord);
  const likelyName = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/.test(firstWord) &&
    !NON_NAME_WORDS.has(normalizedFirstWord) &&
    !DAY_WORDS.has(normalizedFirstWord)
    ? capitalizeWord(firstWord)
    : "";
  const dayMatch = normalizedText.match(/\b(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  const timeMatch = normalizedText.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/);
  const day = dayMatch ? DAY_LABELS[dayMatch[0]] || dayMatch[0] : "";
  const hour = timeMatch ? timeMatch[0] : "";

  return { likelyName, day, hour };
}

function buildAppointmentDataResponse(text) {
  const { likelyName, day, hour } = extractAppointmentData(text);

  if (!day || !hour) {
    return RESPONSES.APPOINTMENT_DATA;
  }

  const greeting = likelyName ? `De acuerdo, ${likelyName}.` : "De acuerdo.";
  const preference = `Tengo registrada tu preferencia para ${day} a las ${hour}.`;

  return `${greeting}\n${preference}\nTe contactaremos para confirmar la revisión.`;
}

function classifyMessage(text) {
  const normalizedText = normalizeText(text);

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

function updateSessionMemory(session, normalizedText, intent, response, awaiting = null) {
  const now = new Date().toISOString();

  session.lastIntent = intent;
  session.lastIncomingText = normalizedText;
  session.lastResponse = response;
  session.lastIncomingAt = now;
  session.updatedAt = now;
  session.awaiting = awaiting;

  upsertSession(session);
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
    const response = buildAppointmentDataResponse(incomingText);
    updateSessionMemory(activeSession, normalizedText, "CITA", response, null);

    return {
      replies: [response],
      session: activeSession,
    };
  }

  const intent = classifyMessage(incomingText);
  const response = resolveResponse(intent, normalizedText, activeSession);
  const awaiting = intent === "CITA" ? "APPOINTMENT_DATA" : null;

  updateSessionMemory(activeSession, normalizedText, intent, response, awaiting);

  return {
    replies: [response],
    session: activeSession,
  };
}

module.exports = {
  handleIncomingText,
};
