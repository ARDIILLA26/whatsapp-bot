const { formatCurrencyMXN } = require("./helpers");

function normalizeSquareMeters(input, plusFallback) {
  const value = String(input || "").trim().replace(/\s+/g, "");

  if (["50", "80", "120", "200"].includes(value)) {
    return Number(value);
  }

  if (value === "+") {
    return plusFallback;
  }

  return null;
}

function normalizeMaterial(input) {
  const value = String(input || "").trim().toLowerCase();

  if (["concreto", "mixto", "ligero"].includes(value)) {
    return value;
  }

  return null;
}

function calculateRiskEstimate({ squareMeters, material, baseCostPerM2, multipliers }) {
  const multiplier = multipliers[material] || 1;
  const estimatedValue = Math.round(squareMeters * baseCostPerM2 * multiplier);

  return {
    squareMeters,
    baseCostPerM2,
    material,
    multiplier,
    estimatedValue,
    displayedCostRange: "10,000 - 18,000 MXN por m2",
  };
}

function buildEstimateMessage({ estimate, location, squareMeters, material }) {
  return `Monto estimado: ${formatCurrencyMXN(estimate.estimatedValue)}
Ubicacion: ${location}
Metros cuadrados: ${squareMeters}
Tipo de construccion: ${material}
Referencia de costo: ${estimate.displayedCostRange}

No incluye:
- terreno
- danos a terceros
- contenido interior
- acabados especiales
- variaciones por inspeccion fisica`;
}

module.exports = {
  normalizeSquareMeters,
  normalizeMaterial,
  calculateRiskEstimate,
  buildEstimateMessage,
};
