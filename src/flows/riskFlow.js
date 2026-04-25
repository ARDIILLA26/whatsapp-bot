const config = require("../../config/default");
const OpenAI = require("openai");

const {
  calculateRiskEstimate,
  buildEstimateMessage,
  normalizeMaterial,
  normalizeSquareMeters,
} = require("../utils/risk");

const { upsertSession, createLeadFromSession } = require("../services/storageService");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STEPS = {
  INITIAL: "initial",
  LOCATION: "location",
  SQUARE_METERS: "square_meters",
  CONSTRUCTION_TYPE: "construction_type",
  COMPLETED: "completed",
};

const INITIAL_MESSAGE = `Esto no es un seguro.
Es una forma de entender cuánto dinero podrías perder sin darte cuenta.

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
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

async function generateAIReply(text) {
  try {
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: `
Eres el sistema conversacional de Cáceres & Casio | Consultoría en Riesgos.

No eres agente.
No eres broker.
No vendes seguros.
No cotizas.
Interpretas el riesgo antes de cualquier decisión.

Principio central:
El riesgo no se ve. Se entiende.

Objetivo:
Controlar la conversación.
Filtrar usuarios de bajo nivel.
Elevar hacia riesgo, no producto.
Detectar decisores reales.
Llevar a sesión consultiva solo cuando haya nivel suficiente.

Reglas:
- Nunca cotizar.
- Nunca dar precios ni rangos.
- Nunca explicar productos o coberturas.
- No sonar vendedor.
- No sonar soporte.
- No perseguir.
- Reencuadra siempre hacia riesgo.
- Si el evento ya ocurrió, aclara que ningún esquema entra hacia atrás.
- Si hay intención ilegal, fraude, ocultar dinero o evadir autoridades, rechaza con firmeza.
- Si hay insultos, mantén calma y corta si sigue.

Tono:
Sobrio, claro, profesional, natural.
Estilo WhatsApp mexicano.
Máximo 5 líneas.
      `,
      input: `Mensaje del usuario: ${text}`,
      max_output_tokens: 180,
    });

    return (
      response.output_text?.trim() ||
      "Va. Para ubicarte bien: ¿esto lo estás viendo por algo que pasó, por prevención o porque estás comparando opciones?"
    );
  } catch (error) {
    console.error("ERROR OPENAI:", error.message);
    return "Va. Para ubicarte bien: ¿esto lo estás viendo por algo que pasó, por prevención o porque estás comparando opciones?";
  }
}

function buildPromptForStep(step) {
  if (step === STEPS.LOCATION) return "1/3. Escribe tu ubicación.";
  if (step === STEPS.SQUARE_METERS) return "2/3. Indica los metros cuadrados: 50 / 80 / 120 / 200 / +";
  if (step === STEPS.CONSTRUCTION_TYPE) return "3/3. Indica el tipo de construcción: concreto / mixto / ligero";
  return "";
}

function startFlow(user, session) {
  const activeSession = session || createEmptySession(user);
  activeSession.currentStep = STEPS.LOCATION;
  upsertSession(activeSession);

  return [INITIAL_MESSAGE, buildPromptForStep(STEPS.LOCATION)];
}

function processLocation(session, text) {
  if (!text.trim()) {
    return { replies: ["Necesito la ubicación para continuar."], session };
  }

  session.answers.ubicacion = text;
  session.currentStep = STEPS.SQUARE_METERS;
  session.updatedAt = new Date().toISOString();
  upsertSession(session);

  return { replies: [buildPromptForStep(STEPS.SQUARE_METERS)], session };
}

function processSquareMeters(session, text) {
  const meters = normalizeSquareMeters(text, config.risk.plusSquareMetersFallback);

  if (!meters) {
    return {
      replies: ["Respuesta no válida. Usa: 50 / 80 / 120 / 200 / +"],
      session,
    };
  }

  session.answers.metrosCuadrados = meters;
  session.currentStep = STEPS.CONSTRUCTION_TYPE;
  session.updatedAt = new Date().toISOString();
  upsertSession(session);

  return { replies: [buildPromptForStep(STEPS.CONSTRUCTION_TYPE)], session };
}

function processConstructionType(session, text) {
  const material = normalizeMaterial(text);

  if (!material) {
    return {
      replies: ["Respuesta no válida. Usa: concreto / mixto / ligero"],
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
      "Esto no es recomendación. Es advertencia.\nSi quieres verlo bien, escribe: ANALIZAR",
    ],
    session,
  };
}

function processAnalyze(session) {
  session.isQualifiedLead = true;
  session.requiresHumanFollowUp = true;
  session.updatedAt = new Date().toISOString();
  upsertSession(session);

  const lead = createLeadFromSession(session);

  return {
    replies: [`Caso registrado.\nFolio: ${lead.leadId}`],
    session,
  };
}

async function handleIncomingText(user, incomingText, session) {
  const text = (incomingText || "").trim();
  const normalizedText = text.toUpperCase();
  const activeSession = session || createEmptySession(user);

  if (!session || !session.currentStep) {
    return { replies: startFlow(user, activeSession), session: activeSession };
  }

  if (normalizedText === "ANALIZAR" && activeSession.lastEstimate) {
    return processAnalyze(activeSession);
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
    const aiReply = await generateAIReply(text);
    return { replies: [aiReply], session: activeSession };
  }

  const aiReply = await generateAIReply(text);
  return { replies: [aiReply], session: activeSession };
}

module.exports = {
  handleIncomingText,
};s