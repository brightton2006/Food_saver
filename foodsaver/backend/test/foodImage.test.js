const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchFoodImage,
  normalizeFoodName,
  buildQueries,
} = require("../src/services/foodImageService");

test("normalizeFoodName cleans up whitespace and formatting", () => {
  assert.equal(normalizeFoodName("   Parotta  "), "parotta");
  assert.equal(normalizeFoodName("Kothu    Parotta"), "kothu parotta");
  assert.equal(normalizeFoodName(""), "");
});

test("buildQueries produces intelligent South Indian search queries", () => {
  const queries = buildQueries("Kothu Parotta", "Restaurant", "South Indian");
  assert.ok(queries.some((q) => q.includes("kothu parotta")), "should include base keyword");
  assert.ok(queries.length >= 3, "should generate multiple escalation queries");
});

test("fetchFoodImage returns exact curated food image for Parotta", async () => {
  const res = await fetchFoodImage("Parotta");
  assert.equal(res.success, true);
  assert.equal(res.foodName, "Parotta");
  assert.ok(res.imageUrl.includes("http"), "should return valid image URL");
  assert.ok(
    res.source.includes("Parotta"),
    "should describe Parotta image source"
  );
});

test("fetchFoodImage returns exact curated food image for Kothu Parotta", async () => {
  const res = await fetchFoodImage("Kothu Parotta");
  assert.equal(res.success, true);
  assert.equal(res.foodName, "Kothu Parotta");
  assert.ok(res.imageUrl.includes("http"));
});

test("fetchFoodImage returns exact curated food image for Chicken Biryani", async () => {
  const res = await fetchFoodImage("Chicken Biryani");
  assert.equal(res.success, true);
  assert.equal(res.foodName, "Chicken Biryani");
  assert.ok(res.imageUrl.includes("http"));
});

test("fetchFoodImage returns exact curated food image for Filter Coffee", async () => {
  const res = await fetchFoodImage("Filter Coffee");
  assert.equal(res.success, true);
  assert.equal(res.foodName, "Filter Coffee");
  assert.ok(res.imageUrl.includes("http"));
});

test("fetchFoodImage returns graceful no-image result when empty string is provided", async () => {
  const res = await fetchFoodImage("");
  assert.equal(res.success, false);
  assert.equal(res.imageUrl, "");
});
