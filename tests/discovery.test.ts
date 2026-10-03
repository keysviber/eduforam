import { test } from "node:test";
import assert from "node:assert/strict";
import {
  grades,
  matchesHomeGrade,
  curriculum,
  languageCategories,
} from "../src/discovery.ts";

test("home includes exactly the adjacent school grades", () => {
  assert.deepEqual(
    grades.filter((g) => matchesHomeGrade(g, "Form 4")),
    ["Form 3", "Form 4", "Form 5"],
  );
  assert.equal(matchesHomeGrade("Grade 7", "Form 4"), false);
  assert.deepEqual(
    grades.filter((g) => matchesHomeGrade(g, "Form 1")),
    ["Grade 7", "Form 1", "Form 2"],
  );
  assert.deepEqual(
    grades.filter((g) => matchesHomeGrade(g, "Grade 1")),
    ["Grade 1", "Grade 2"],
  );
  assert.deepEqual(
    grades.filter((g) => matchesHomeGrade(g, "Form 6")),
    ["Form 5", "Form 6"],
  );
  assert.equal(matchesHomeGrade("All levels", "Form 4"), false);
  assert.equal(matchesHomeGrade("Secondary", "Form 4"), false);
  assert.equal(matchesHomeGrade("Form 4", null), false);
  assert.equal(matchesHomeGrade("Form 4", "invalid"), false);
});
test("each language has an ordered curriculum with unambiguous quizzes", () => {
  assert.equal(languageCategories[0], "Greetings");
  for (const language of curriculum) {
    assert.equal(language.units.length, languageCategories.length);
    for (const words of language.units) {
      assert.equal(words.length, 3);
      assert.equal(new Set(words.map((w) => w[1])).size, words.length);
    }
  }
});
