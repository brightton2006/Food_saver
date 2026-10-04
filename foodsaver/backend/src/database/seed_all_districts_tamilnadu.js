const { integrateAllDistrictHotels } = require("./integrate_all_district_hotels");

async function seedAllTamilNaduDistricts() {
  console.log("=================================================");
  console.log("🌏 SEEDING HOTELS & FOOD LISTINGS ACROSS ALL 38 TAMIL NADU DISTRICTS");
  console.log("=================================================\n");
  return await integrateAllDistrictHotels();
}

if (require.main === module) {
  seedAllTamilNaduDistricts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error seeding Tamil Nadu district hotels:", err);
      process.exit(1);
    });
}

module.exports = { seedAllTamilNaduDistricts };
