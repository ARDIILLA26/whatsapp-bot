const RESPONSES = {
  SALUDO: "Cáceres & Casio, consultoría en riesgos.\nAquí primero entendemos el riesgo y luego se decide.\n¿Qué traes en mente?",
  PRECIO: "Claro, el precio es importante.\nPara orientarte bien, primero necesito entender qué quieres proteger.\n¿Qué situación te preocupa más?",
  INSISTE_EN_PRECIO: "Te entiendo.\nPara darte una orientación útil, necesito ubicar primero la situación.\n¿Es algo personal, familiar, patrimonial o de empresa?",
  MEJOR_PRECIO: "Entiendo que quieras cuidar el presupuesto.\nPrimero veamos qué necesitas proteger.\nAsí evitamos pagar por algo que no te sirva.",
  INFORMES: "Claro.\nPara mandarte información útil, necesito saber qué quieres revisar.\n¿Es algo personal, familiar, patrimonial o de empresa?",
  COBERTURAS: "Claro, podemos revisarlo.\nPrimero necesito entender qué situación quieres proteger.\n¿Qué te preocupa más?",
  COMPARACION: "Está bien comparar.\nSolo hay que cuidar que la comparación realmente te ayude a decidir.\n¿Qué quieres proteger o resolver?",
  EMPRESA: "Perfecto.\nEn empresa conviene revisar operación, personas, activos y consecuencias.\n¿Qué parte te preocupa más hoy?",
  FAMILIA: "Entiendo.\nCuando se trata de familia, primero hay que ver qué quieres cuidar.\n¿Te preocupa más ingreso, salud o patrimonio?",
  SALUD: "Claro.\nEn salud conviene revisar el impacto económico antes de decidir.\n¿La preocupación es por ti, tu familia o tu empresa?",
  VIDA: "Entiendo.\nEn vida conviene revisar quién depende de tu ingreso.\n¿Quién necesitaría mayor respaldo si algo llegara a pasar?",
  PATRIMONIO: "Claro.\nPara cuidar tu patrimonio, primero ubicamos qué parte necesita más atención.\n¿Te preocupa más una propiedad, un auto o tu estabilidad económica?",
  YA_TIENE_SEGURO: "Perfecto, eso ayuda.\nPodemos revisar si lo que tienes sigue respondiendo a tu situación actual.\n¿Qué te gustaría revisar primero?",
  NO_SABE: "Es normal empezar así.\nPrimero ordenamos la situación y después vemos qué conviene.\n¿Qué te preocupa más en este momento?",
  CONFUSION: "Tiene sentido.\nCuando hay muchas opiniones, conviene ordenar la situación.\n¿Qué parte te está generando más duda?",
  IMPACTO: "Eso ya es una señal importante.\nConviene revisarlo con calma antes de decidir.\n¿Quieres que lo veamos 20 min?",
  URGENCIA: "Entiendo la urgencia.\nJusto por eso conviene decidir con claridad.\n¿Puedes revisarlo hoy 20 min?",
  NO_TIENE_DINERO: "Te entiendo.\nCuando el presupuesto importa, conviene decidir con más cuidado.\n¿Qué situación te preocupa atender primero?",
  OBJECION_DE_PAGO: "Lo entiendo.\nLa revisión solo tiene sentido si te ayuda a decidir mejor.\n¿Quieres verlo 20 min y después decides?",
  TODO_POR_CHAT: "Por aquí puedo orientarte.\nPara una recomendación seria necesito más contexto.\n¿Quieres que lo revisemos 20 min?",
  ERES_AGENTE: "Soy consultor en riesgos.\nPrimero reviso la situación y después vemos qué solución tiene sentido.\n¿Qué quieres proteger o resolver?",
  REFERIDO: "Perfecto, gracias por escribirme.\nPara ayudarte bien, empecemos por entender la situación.\n¿Qué necesitas revisar?",
  NO_RESPONDE_CLARO: "Vamos paso a paso.\nPara orientarte mejor, dime qué tema quieres revisar.\n¿Familia, salud, patrimonio o empresa?",
  ACEPTA_CITA: "Perfecto.\nAgendamos una revisión de 20 min.\nCompárteme tu nombre y el horario que prefieres.",
  NO_PUEDE_HOY_NI_MANANA: "Está bien.\nDime qué día te funciona esta semana.\nLo revisamos 20 min y ordenamos la situación.",
  LO_VA_A_PENSAR: "Claro, tómate tu tiempo.\nSolo procura decidir con la información bien ordenada.\nCuando quieras, lo revisamos.",
  FALTA_DE_RESPETO: "Prefiero mantener la conversación con respeto.\nSi quieres revisarlo seriamente, con gusto lo vemos.",
};

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function classifyMessage(text) {
  const normalized = normalizeText(text);

  if (!normalized || includesAny(normalized, ["hola", "buen dia", "buenas", "hey", "que tal"])) {
    return "SALUDO";
  }

  if (includesAny(normalized, ["pendej", "idiot", "estupid", "ching", "vete", "callate"])) {
    return "FALTA_DE_RESPETO";
  }

  if (includesAny(normalized, ["me refirio", "referido", "me recomendaron", "vengo de parte"])) {
    return "REFERIDO";
  }

  if (includesAny(normalized, ["agendar", "agenda", "cita", "reunion", "llamada", "20 min", "veamoslo", "lo revisamos"])) {
    return "ACEPTA_CITA";
  }

  if (includesAny(normalized, ["no puedo hoy", "no puedo manana", "otro dia", "esta semana"])) {
    return "NO_PUEDE_HOY_NI_MANANA";
  }

  if (includesAny(normalized, ["lo pienso", "lo voy a pensar", "despues", "luego te digo"])) {
    return "LO_VA_A_PENSAR";
  }

  if (includesAny(normalized, ["eres agente", "son agentes", "broker", "vendes seguros", "vendedor"])) {
    return "ERES_AGENTE";
  }

  if (includesAny(normalized, ["por chat", "aqui mismo", "por aqui", "mandamelo aqui"])) {
    return "TODO_POR_CHAT";
  }

  if (includesAny(normalized, ["pagar consulta", "cobras", "costo de revision", "pagar por revisar"])) {
    return "OBJECION_DE_PAGO";
  }

  if (includesAny(normalized, ["no tengo dinero", "sin dinero", "no me alcanza", "presupuesto bajo"])) {
    return "NO_TIENE_DINERO";
  }

  if (includesAny(normalized, ["urgente", "hoy", "rapido", "ya", "me urge"])) {
    return "URGENCIA";
  }

  if (includesAny(normalized, ["impacto", "perder", "perdida", "riesgo grande", "me preocupa mucho"])) {
    return "IMPACTO";
  }

  if (includesAny(normalized, ["no entiendo", "confundido", "confusa", "duda", "muchas opiniones"])) {
    return "CONFUSION";
  }

  if (includesAny(normalized, ["no se", "no estoy seguro", "no tengo claro", "orientame"])) {
    return "NO_SABE";
  }

  if (includesAny(normalized, ["ya tengo seguro", "tengo seguro", "poliza", "mi seguro actual"])) {
    return "YA_TIENE_SEGURO";
  }

  if (includesAny(normalized, ["patrimonio", "propiedad", "casa", "auto", "estabilidad economica"])) {
    return "PATRIMONIO";
  }

  if (includesAny(normalized, ["vida", "fallezco", "muerte", "depende de mi ingreso"])) {
    return "VIDA";
  }

  if (includesAny(normalized, ["salud", "gastos medicos", "hospital", "enfermedad"])) {
    return "SALUD";
  }

  if (includesAny(normalized, ["familia", "hijos", "esposa", "esposo", "padres"])) {
    return "FAMILIA";
  }

  if (includesAny(normalized, ["empresa", "negocio", "empleados", "activos", "operacion"])) {
    return "EMPRESA";
  }

  if (includesAny(normalized, ["comparar", "comparacion", "aseguradora", "aseguradoras", "opciones"])) {
    return "COMPARACION";
  }

  if (includesAny(normalized, ["cobertura", "coberturas", "que cubre", "incluye"])) {
    return "COBERTURAS";
  }

  if (includesAny(normalized, ["informes", "informacion", "info", "mandame datos"])) {
    return "INFORMES";
  }

  if (includesAny(normalized, ["mejor precio", "mas barato", "barato", "economico"])) {
    return "MEJOR_PRECIO";
  }

  if (includesAny(normalized, ["precio", "cuanto cuesta", "cotiza", "cotizacion", "costo"])) {
    return "PRECIO";
  }

  return "NO_RESPONDE_CLARO";
}

async function handleIncomingText(user, incomingText, session) {
  const intent = classifyMessage(incomingText);

  return {
    replies: [RESPONSES[intent]],
    session: session || {
      userId: user?.userId || "",
      phoneNumber: user?.phoneNumber || "",
      profileName: user?.profileName || "",
    },
  };
}

module.exports = {
  handleIncomingText,
};
