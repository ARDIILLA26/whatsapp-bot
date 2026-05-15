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

module.exports = {
  normalizeText,
  capitalizeWord,
  includesAny,
};
