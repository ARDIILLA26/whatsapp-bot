function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  app: {
    port: parseNumber(process.env.PORT, 3000),
    baseUrl: process.env.APP_BASE_URL || "",
  },
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    verifyToken: process.env.META_VERIFY_TOKEN || "",
  },
  risk: {
    defaultCostPerM2: parseNumber(process.env.DEFAULT_COST_PER_M2, 14000),
    costRangeMin: 10000,
    costRangeMax: 18000,
    plusSquareMetersFallback: parseNumber(process.env.PLUS_SQUARE_METERS_FALLBACK, 250),
    multipliers: {
      concreto: parseNumber(process.env.CONCRETE_MULTIPLIER, 1.15),
      mixto: parseNumber(process.env.MIXED_MULTIPLIER, 1.0),
      ligero: parseNumber(process.env.LIGHT_MULTIPLIER, 0.82),
    },
  },
};
