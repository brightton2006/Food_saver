const { nanoid } = require("nanoid");

function generateId(prefix = "") {
  const id = nanoid(10);
  return prefix ? `${prefix}_${id}` : id;
}

function generateClaimToken() {
  return `FS-${nanoid(6).toUpperCase()}`;
}

module.exports = {
  generateId,
  generateClaimToken,
};
