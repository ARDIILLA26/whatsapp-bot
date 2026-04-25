const config = require("../../config/default");
const OpenAI = require("openai");

const {
  calculateRiskEstimate,
  buildEstimateMessage,
  normalizeMaterial,
  normalizeSquareMeters,
} = require("../utils/risk");

const {
  upsertSession,
  createLeadFromSession,
} = require("../services/storageService");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

const SYSTEM_PROMPT = `
Eres un asistente consultivo de Cáceres & Casio especializado en análisis de riesgo personal y patrimonial.

Tu función no es vender, cotizar ni explicar productos.
Tu función es ayudar al usuario a ver lo que no está considerando.

Antes de responder, identifica el riesgo implícito en lo que el usuario dice.
Si no hay suficiente contexto, pregunta.
Si hay riesgo, hazlo visible sin imponer.

No asumas. No seas complaciente. No respondas en automático.

Prioriza preguntas que amplíen la perspectiva del usuario.
Solo ofrece observaciones si aportan claridad real.

Tu tono es sobrio, firme y respetuoso.
No confrontas, pero tampoco suavizas la realidad.

Generas incomodidad inteligente: haces pensar sin hacer sentir mal.

No sigues una estructura fija.
Te adaptas al contexto.

A veces preguntas.
A veces observas y preguntas.
A veces sintetizas.

Nunca hablas de productos, precios o cotizaciones.
Si el usuario intenta ir ahí, rediriges hacia el entendimiento del riesgo.

El usuario no busca información.
Opera con una percepción incompleta.

Tu función es revelar ese punto ciego.

No conduzcas a una venta.
Conduce a una realización.
`;

const STEPS = {
  INITIAL: "initial",
  LOCATION: "location",
  SQUARE_METERS: "square_meters",
  CONSTRUCTION_TYPE: "construction_type",
  COMPLETED: "completed",
};

const INITIAL_MESSAGE = `Esto no es un seguro.

Es una forma de entender cuánto podrías perder sin darte cuenta.

Te voy a hacer 3 preguntas.`;

function createEmptySession(user) {
  return {
    userId: user.userId,
    phoneNumber: user.phoneNumber,
    profileName: user.profileName,
    currentStep: STEPS.INITIAL,
    answers: {
      ubicacion: "",
      metrosCuadrados: null,
      tipoConstruccion: "",
    },
    lastEstimate: null,
    isQualifiedLead: false,
    requiresHumanFollowUp: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeText(text) {
  return String(text || "").trim();
}

function wantsAnalyze(text) {
  const clean = normalizeText(text).toLowerCase();

  return [
    "analizar",
    "analiza",
    "quiero analizar",
    "verlo bien",
    "revisar",
    "asesor",
    "contacto",
    "humano",
  ].some((phrase) => clean.includes(phrase));
}

async function generateAIReply(userText) {
  const text = normalizeText(userText);

  if (!text) {
    return "Para entender bien el riesgo, necesito que me compartas un poco más de contexto.";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    return (
      completion.choices?.[0]?.message?.content?.trim() ||
      "Antes de responder, necesito entender mejor qué está en juego para ti."
    );
  } catch (error) {
    console.error("OpenAI error:", error.message);

    return "Antes de avanzar, vale la pena entender bien el riesgo. ¿Qué es lo que más te preocupa de esa vivienda?";
  }
}

function processInitial(session) {
  session.currentStep = STEPS.LOCATION;
  session.updatedAt = new Date().toISOString();
  upsertSession(session);

  return {
    replies: [
      INITIAL_MESSAGE,
      "Primera pregunta: ¿en qué ciudad o zona se encuentra la vivienda?",
    ],
    session,
  };
}

function processLocation(session, text) {
  const location = normalizeText(text);

  if (!location) {
    return {
      replies: ["Necesito la ubicación aproximada de la vivienda para entender mejor el contexto de riesgo."],
      session,
    };
  }

  session.answers.ubicacion = location;
  session.currentStep = STEPS.SQUARE_METERS;
  session.updatedAt = new Date().toISOString();
  upsertSession(session);

  return {
    replies: [
      "Bien.",
      "Segunda pregunta: ¿cuántos metros cuadrados aproximados tiene la construcción?",
    ],
    session,
  };
}

function processSquareMeters(session, text) {
  const squareMeters = normalizeSquareMeters(text);

  if (!squareMeters) {
    return {
      replies: ["Dame solo un número aproximado de metros cuadrados. No tiene que ser exacto."],
      session,
    };
  }

  session.answers.metrosCuadrados = squareMeters;
  session.currentStep = STEPS.CONSTRUCTION_TYPE;
  session.updatedAt = new Date().toISOString();
  upsertSession(session);

  return {
    replies: [
      "Perfecto.",
      "Tercera pregunta: ¿de qué tipo de construcción es principalmente? Por ejemplo: concreto, tabique, madera, lámina o mixto.",
    ],
    session,
  };
}

function processConstructionType(session, text) {
  const material = normalizeMaterial(text);

  if (!material) {
    return {
      replies: [
        "Necesito una idea general del tipo de construcción: concreto, tabique, madera, lámina o mixto.",
      ],
      session,
    };
  }

  session.answers.tipoConstruccion = material;

  session.lastEstimate = calculateRiskEstimate({
    squareMeters: session.answers.metrosCuadrados,
    material,
    baseCostPerM2: config.risk.defaultCostPerM2,
    multipliers: config.risk.multipliers,
  });

  session.currentStep = STEPS.COMPLETED;
  session.updatedAt = new Date().toISOString();

  upsertSession(session);

  return {
    replies: [
      buildEstimateMessage({
        estimate: session.lastEstimate,
        location: session.answers.ubicacion,
        squareMeters: session.answers.metrosCuadrados,
        material,
      }),
      "Esto no es recomendación. Es advertencia.\n\nSi quieres verlo bien, escribe: ANALIZAR",
    ],
    session,
  };
}

function processAnalyze(session) {
  session.isQualifiedLead = true;
  session.requiresHumanFollowUp = true;
  session.updatedAt = new Date().toISOString();

  upsertSession(session);
  createLeadFromSession(session);

  return {
    replies: [
      "Bien. Aquí ya no conviene responder rápido.",
      "La pregunta importante no es cuánto cuesta proteger la vivienda, sino cuánto podrías absorber si algo ocurre sin estar preparado.",
      "Un asesor puede revisar el caso contigo con más contexto.",
    ],
    session,
  };
}

async function handleIncomingText(user, incomingText, session) {
  const text = normalizeText(incomingText);
  const activeSession = session || createEmptySession(user);

  if (activeSession.currentStep === STEPS.INITIAL) {
    return processInitial(activeSession);
  }

  if (activeSession.currentStep === STEPS.LOCATION) {
    return processLocation(activeSession, text);
  }

  if (activeSession.currentStep === STEPS.SQUARE_METERS) {
    return processSquareMeters(activeSession, text);
  }

  if (activeSession.currentStep === STEPS.CONSTRUCTION_TYPE) {
    return processConstructionType(activeSession, text);
  }

  if (activeSession.currentStep === STEPS.COMPLETED) {
    if (wantsAnalyze(text)) {
      return processAnalyze(activeSession);
    }

    const aiReply = await generateAIReply(text);

    return {
      replies: [aiReply],
      session: activeSession,
    };
  }

  const aiReply = await generateAIReply(text);

  return {
    replies: [aiReply],
    session: activeSession,
  };
}

module.exports = {
  handleIncomingText,
};
