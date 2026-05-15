function isSecurityIntent(intent) {
  return intent === "PIRATEO_SISTEMA";
}

module.exports = {
  isSecurityIntent,
};
