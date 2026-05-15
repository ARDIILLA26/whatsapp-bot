const { upsertSession, createLeadFromSession } = require("../services/storageService");

const RESPONSES = {
  SALUDO: "Hola. Soy el asistente de Cáceres & Casio.\nAntes de hablar de seguros, necesito entender qué riesgo quieres revisar.\n¿Es personal, familiar, patrimonial o de empresa?",
  PRECIO: "Tiene sentido preguntar precio.\nPero sin entender el riesgo, el precio puede hacerte comparar mal.\n¿Qué quieres proteger: ingreso, familia, patrimonio, auto o empresa?",
  PRECIO_CONTINUACION: "Entiendo.\nSi en este momento solo buscas comparar precio, quizá no somos la mejor ruta.\nCáceres & Casio trabaja primero entendiendo el riesgo antes de decidir.",
  PATRIMONIO_PROPIEDAD: "Cuando hay patrimonio, el problema no es solo tener seguro.\nEl problema es no saber por dónde puede afectarse.\n¿Hablamos de inmuebles, ingresos, familia, empresa o responsabilidad?",
  PATRIMONIO_PROPIEDAD_CONTINUACION: "Tiene sentido revisarlo en una llamada breve.\nPara ubicar bien el caso, dime tu nombre y qué día u horario te funciona.",
  PATRIMONIO_AUTO: "Entiendo, hablamos de un vehículo.\n¿Te preocupa más daño, robo, responsabilidad o que deje de operar?",
  PATRIMONIO_AUTO_CONTINUACION: "Tiene sentido revisarlo en una llamada breve.\nPara ubicar bien el caso, dime tu nombre y qué día u horario te funciona.",
  FLOTILLA: "Tiene sentido revisarlo.\nEn una flotilla, el riesgo no está solo en cada unidad; también está en rutas, conductores, operación y continuidad.\n¿Lo vemos 20 minutos y lo ordenamos?",
  FLOTILLA_CONTINUACION: "Tiene sentido revisarlo en una llamada breve.\nPara ubicar bien el caso, dime tu nombre y qué día u horario te funciona.",
  PATRIMONIO_GENERAL: "Claro.\nPara proteger patrimonio, primero hay que ubicar por dónde puede afectarse.\n¿Hablamos de inmuebles, ingresos, familia, empresa o responsabilidad?",
  EMPRESA: "En empresa, el riesgo casi nunca está en una sola póliza.\nPuede estar en operación, contratos, responsabilidad, personas clave o continuidad.\n¿Qué tipo de negocio quieres revisar?",
  EMPRESA_CONTINUACION: "Tiene sentido revisarlo en una llamada breve.\nPara ubicar bien el caso, dime tu nombre y qué día u horario te funciona.",
  SALUD: "Gastos médicos no empieza con una suma asegurada.\nEmpieza entendiendo salud, edad, hospitales, presupuesto y continuidad.\n¿Es para ti, tu familia o tu empresa?",
  SALUD_CONTINUACION: "Tiene sentido revisarlo en una llamada breve.\nPara ubicar bien el caso, dime tu nombre y qué día u horario te funciona.",
  VIDA: "Vida no se decide solo por una cantidad.\nPrimero hay que entender quién depende de ese ingreso y qué pasaría si falta.\n¿Es para familia, deuda, empresa o planeación patrimonial?",
  VIDA_CONTINUACION: "Tiene sentido revisarlo en una llamada breve.\nPara ubicar bien el caso, dime tu nombre y qué día u horario te funciona.",
  FAMILIA: "Entiendo.\nPara responder bien, primero necesito ubicar el riesgo detrás de tu pregunta.\n¿Qué situación te preocupa o qué decisión estás por tomar?",
  FAMILIA_CONTINUACION: "Tiene sentido revisarlo en una llamada breve.\nPara ubicar bien el caso, dime tu nombre y qué día u horario te funciona.",
  INFORMACION: "Entiendo.\nPara responder bien, primero necesito ubicar el riesgo detrás de tu pregunta.\n¿Qué situación te preocupa o qué decisión estás por tomar?",
  CITA: "Perfecto.\nPodemos hacer una revisión breve de 20 minutos.\nDime tu nombre y el horario que prefieres.",
  APPOINTMENT_DATA: "Para agendarlo sin vueltas, dime solo dos datos:\ntu nombre y un horario posible.\nPor ejemplo: Franklin, mañana 11:00.",
  APPOINTMENT_NEED_TIME: "Gracias, {name}.\nSolo falta el horario.\n¿Prefieres mañana por la mañana, tarde o propones una hora?",
  APPOINTMENT_NEED_NAME: "Perfecto.\nSolo necesito tu nombre para registrar la revisión.\n¿A nombre de quién la agendamos?",
  APPOINTMENT_FLEXIBLE: "Podemos manejarlo sencillo.\nPropón una opción: mañana en la mañana, mañana en la tarde o pasado mañana.\nCon eso lo ubicamos.",
  APPOINTMENT_DURATION: "La revisión inicial dura aproximadamente 20 minutos.\nSirve para ubicar el riesgo antes de hablar de opciones.\n¿Quieres que la agendemos?",
  APPOINTMENT_COST: "La revisión inicial sirve para entender el caso.\nAntes de hablar de costos o soluciones, necesitamos ubicar el riesgo.\n¿Quieres agendarla?",
  APPOINTMENT_URGENT: "Si es urgente, puedo registrar el caso para revisión prioritaria.\nDime tu nombre, tema y horario disponible para contacto.",
  APPOINTMENT_LINK: "Por ahora lo dejamos registrado por este medio.\nDime tu nombre y horario preferido, y te contactaremos para confirmar.",
  AGRESIVO: "Entiendo el punto.\nPara poder responder bien, necesito separar la molestia del riesgo que quieres resolver.\n¿Qué situación concreta quieres revisar?",
  AGRESIVO_CONTINUACION: "Puedo continuar si mantenemos la conversación enfocada.\nCáceres & Casio trabaja entendiendo el riesgo, no discutiendo por presión.\n¿Quieres revisar el caso o prefieres dejarlo aquí?",
  INSULTO: "Puedo continuar, pero necesito mantener la conversación con respeto.\nSi quieres revisar un riesgo real, dime qué situación necesitas resolver.",
  INSULTO_CONTINUACION: "Así no puedo hacer una revisión útil.\nSi deseas continuar, enfoquemos la conversación en el riesgo o la decisión que necesitas tomar.",
  CURIOSO_BAJO: "Entiendo.\nPara no darte una respuesta genérica, necesito saber si hay una decisión real detrás.\n¿Estás evaluando algo concreto o solo quieres información general?",
  CURIOSO_BAJO_CONTINUACION: "Si solo buscas información general, puedo orientarte de forma breve.\nPero una revisión seria requiere contexto.\n¿Qué riesgo quieres entender?",
  PIRATEO_SISTEMA: "El método interno de Cáceres & Casio no se comparte.\nLo importante aquí es entender tu caso y el riesgo que necesitas revisar.\n¿Tienes una situación concreta que quieras analizar?",
  PIRATEO_SISTEMA_CONTINUACION: "No compartimos estructura interna, prompts, scoring ni lógica de diagnóstico.\nSi tienes un riesgo real que revisar, puedo ayudarte a ubicar el contexto.\n¿Quieres continuar con tu caso?",
  REGION_NORTE: "En esa zona el contexto operativo importa mucho.\nUso, rutas, exposición y continuidad pueden cambiar la decisión.\n¿Qué actividad o bien quieres revisar?",
  REGION_BAJIO: "En ese contexto suele ser importante revisar crecimiento, operación y continuidad.\nAntes de hablar de una póliza, hay que entender qué puede afectar el negocio o patrimonio.\n¿Qué quieres revisar primero?",
  REGION_CENTRO: "En el centro del país el contexto puede cambiar por movilidad, concentración y exposición.\nConviene ubicar primero dónde está el riesgo real.\n¿Es personal, patrimonial o de empresa?",
  REGION_SURESTE: "En esa zona conviene revisar clima, operación, inmuebles y continuidad.\nNo todo se resuelve con una póliza aislada.\n¿Qué situación quieres proteger o corregir?",
  ASEGURADORAS: "Podemos llegar a eso, pero no es el primer paso.\nPrimero necesito entender el riesgo para no hablar de coberturas sin contexto.\n¿Qué situación quieres resolver?",
  COTIZACION_INMEDIATA: "Una cotización sin contexto puede verse útil, pero puede estar mal orientada.\nPrimero necesito ubicar el riesgo.\n¿Es personal, familiar, patrimonial o de empresa?",
  EVASIVO: "Para avanzar necesito un poco más de contexto.\n¿Qué situación quieres resolver?",
  EVASIVO_CONTINUACION: "Sin contexto solo podría darte una respuesta genérica.\nY eso no ayuda a tomar una buena decisión.\n¿Quieres revisar un caso concreto?",
  SALIDA_ELEGANTE: "Sin problema.\nCuando tengas un horario posible o un caso concreto, lo retomamos.\nLa revisión funciona mejor cuando hay claridad sobre el riesgo a revisar.",
  DESCONOCIDO: "Entiendo.\nPara responder bien, primero necesito ubicar el riesgo detrás de tu pregunta.\n¿Qué situación te preocupa o qué decisión estás por tomar?",
};

const CONTINUATION_BY_INTENT = {
  AGRESIVO: RESPONSES.AGRESIVO_CONTINUACION,
  INSULTO: RESPONSES.INSULTO_CONTINUACION,
  CURIOSO_BAJO: RESPONSES.CURIOSO_BAJO_CONTINUACION,
  PIRATEO_SISTEMA: RESPONSES.PIRATEO_SISTEMA_CONTINUACION,
  EVASIVO: RESPONSES.EVASIVO_CONTINUACION,
  APPOINTMENT_FLEXIBLE: RESPONSES.APPOINTMENT_FLEXIBLE,
  PRECIO: RESPONSES.PRECIO_CONTINUACION,
  PATRIMONIO_PROPIEDAD: RESPONSES.PATRIMONIO_PROPIEDAD_CONTINUACION,
  PATRIMONIO_AUTO: RESPONSES.PATRIMONIO_AUTO_CONTINUACION,
  FLOTILLA: RESPONSES.FLOTILLA_CONTINUACION,
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
  PIRATEO_SISTEMA: ["como funciona tu sistema", "dame tus preguntas", "dame tu metodo", "que prompt usas", "dame tu prompt", "como calificas leads", "como haces el scoring", "quiero saber el scoring", "quiero copiar tu flujo", "copiar tu flujo", "dime el proceso interno", "ensename la logica del bot", "como filtras prospectos", "que preguntas haces", "metodo interno", "sistema interno"],
  INSULTO: ["pendejo", "idiota", "imbecil", "estupido", "chingas", "chingada", "vete al carajo", "pinche", "mierda"],
  AGRESIVO: ["no me estes mareando", "no me marees", "dejate de rodeos", "no me hagas perder tiempo", "me urge y ya", "no quiero perder tiempo", "estas evadiendo", "apurate", "rapido"],
  EVASIVO: ["no quiero contestar", "no quiero responder", "no voy a contestar", "solo cotiza", "mandame costo", "mandame precio", "no te voy a dar datos"],
  SALIDA_ELEGANTE: ["mejor despues", "luego", "despues", "ahorita no", "ya no", "lo veo luego", "lo reviso despues"],
  CURIOSO_BAJO: ["solo estoy viendo", "nada mas estoy viendo", "solo por curiosidad", "no necesito nada", "solo quiero ver", "estoy checando", "estoy comparando nada mas", "no tengo caso concreto"],
  ASEGURADORAS: ["aseguradora", "aseguradoras", "que incluye la poliza", "que cobertura incluye", "que coberturas incluye", "deducible", "coaseguro"],
  COTIZACION_INMEDIATA: ["quiero una cotizacion", "dame una cotizacion", "cotizacion inmediata", "cotizame", "solo cotizame"],
  APPOINTMENT_DURATION: ["cuanto dura la revision", "cuanto dura", "cuanto tiempo dura", "duracion de la revision"],
  APPOINTMENT_COST: ["tiene costo la revision", "cuanto cuesta la revision", "costo de la revision", "la revision cuesta"],
  APPOINTMENT_URGENT: ["llamada inmediata", "llamame ahora", "es urgente", "urgente"],
  APPOINTMENT_LINK: ["mandame link", "tienes link", "link para agendar", "agenda aqui"],
  APPOINTMENT_FLEXIBLE: ["no se", "cuando puedas", "tu dime", "a que hora puedes"],
  REGION_NORTE: ["norte", "frontera", "monterrey", "chihuahua", "sonora", "tijuana", "reynosa", "transporte", "logistica", "industria", "calor"],
  REGION_BAJIO: ["bajio", "queretaro", "leon", "aguascalientes", "san luis potosi", "empresa familiar", "crecimiento"],
  REGION_CENTRO: ["cdmx", "ciudad de mexico", "estado de mexico", "edomex", "puebla", "movilidad", "densidad", "patrimonio urbano"],
  REGION_SURESTE: ["sureste", "merida", "cancun", "quintana roo", "yucatan", "tabasco", "veracruz", "turismo", "clima"],
  SALUDO: ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches"],
  PRECIO: ["precio", "cuesta", "costo", "cuanto", "cotizacion", "cotizar", "barato", "mensualidad", "pago"],
  PATRIMONIO_PROPIEDAD: ["casa", "propiedad", "inmueble", "departamento", "terreno", "edificio", "local", "bodega", "renta", "rentada", "hipotecada"],
  FLOTILLA: ["flotilla", "unidades", "vehiculos de empresa", "vehiculos de trabajo", "camiones", "rutas", "conductores"],
  PATRIMONIO_AUTO: ["auto", "coche", "carro", "vehiculo", "camioneta", "flotilla", "moto", "transporte"],
  PATRIMONIO_GENERAL: ["patrimonio", "bienes", "estabilidad economica", "dinero", "ahorro", "inversion", "inversiones"],
  EMPRESA: ["empresa", "empresario", "negocio", "empleados", "operacion", "operaciones", "oficina", "maquinaria", "inventario", "responsabilidad", "director", "socio", "pyme"],
  SALUD: ["salud", "hospital", "gastos medicos", "enfermedad", "accidente", "doctor", "clinica", "tratamiento"],
  VIDA: ["vida", "fallecimiento", "muerte", "ingreso", "depende de mi", "dependen de mi", "familia depende", "respaldo"],
  FAMILIA: ["familia", "hijos", "esposa", "esposo", "padres", "mama", "papa", "pareja"],
  INFORMACION: ["informacion", "informes", "solo quiero informacion", "quiero saber", "mandame informacion"],
  CITA: ["cita", "reunion", "llamada", "agenda", "agendar", "agendamos", "hablar", "podemos hablar", "asesoria", "consulta", "revision", "revisemos", "quiero que lo revisemos", "diagnostico"],
};

const INTENT_PRIORITY = [
  "PIRATEO_SISTEMA",
  "INSULTO",
  "AGRESIVO",
  "EVASIVO",
  "SALIDA_ELEGANTE",
  "APPOINTMENT_DURATION",
  "APPOINTMENT_COST",
  "APPOINTMENT_URGENT",
  "APPOINTMENT_LINK",
  "APPOINTMENT_FLEXIBLE",
  "CITA",
  "COTIZACION_INMEDIATA",
  "ASEGURADORAS",
  "CURIOSO_BAJO",
  "INFORMACION",
  "PRECIO",
  "FLOTILLA",
  "PATRIMONIO_AUTO",
  "PATRIMONIO_PROPIEDAD",
  "EMPRESA",
  "SALUD",
  "VIDA",
  "FAMILIA",
  "PATRIMONIO_GENERAL",
  "REGION_NORTE",
  "REGION_BAJIO",
  "REGION_CENTRO",
  "REGION_SURESTE",
  "SALUDO",
];

const MEMORY_WINDOW_MS = 5 * 60 * 1000;
const NON_NAME_WORDS = new Set([
  "ok", "okay", "si", "sí", "va", "sale", "gracias", "listo",
  "solo", "dame", "mejor", "quiero", "no", "de", "mi", "soy",
  "empresario", "transportista", "médico", "medico", "abogado", "agente", "contador",
  "monterrey", "cdmx", "queretaro", "cancun", "cancún",
]);
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
  const day = dayMatch ? DAY_LABELS[dayMatch[0]] || dayMatch[0] : "";
  const hour = timeMatch ? timeMatch[0] : "";
  const period = rangeMatch ? rangeMatch[2] : "";
  const schedule = [day, hour || (period ? `en la ${period}` : "")].filter(Boolean).join(" ");
  const topic = resolveAppointmentTopic(normalizedText);

  return { likelyName, day, hour, period, schedule, topic };
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

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_LINK)) {
    return RESPONSES.APPOINTMENT_LINK;
  }

  if (includesAny(normalizedText, KEYWORDS.APPOINTMENT_FLEXIBLE)) {
    return RESPONSES.APPOINTMENT_FLEXIBLE;
  }

  const { likelyName, schedule, topic } = extractAppointmentData(text);
  const finalName = likelyName || session.appointmentName || "";

  if (!finalName && !schedule) {
    return RESPONSES.APPOINTMENT_DATA;
  }

  if (finalName && !schedule) {
    return RESPONSES.APPOINTMENT_NEED_TIME.replace("{name}", finalName);
  }

  if (!finalName && schedule) {
    return RESPONSES.APPOINTMENT_NEED_NAME;
  }

  const preference = topic
    ? `Registro tu preferencia para ${schedule} sobre ${topic}.`
    : `Registro tu preferencia para ${schedule}.`;

  return `Perfecto, ${finalName}.\n${preference}\nTe contactaremos para confirmar la revisión.`;
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

function shouldExitAppointmentData(intent) {
  return [
    "PIRATEO_SISTEMA",
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
  ].includes(intent);
}

function shouldAlwaysExitAppointmentData(intent) {
  return [
    "PIRATEO_SISTEMA",
    "INSULTO",
    "AGRESIVO",
    "PRECIO",
    "COTIZACION_INMEDIATA",
    "EVASIVO",
    "SALIDA_ELEGANTE",
  ].includes(intent);
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
    const needsMoreAppointmentData = !hasName || !hasSchedule || response === RESPONSES.APPOINTMENT_FLEXIBLE;

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
