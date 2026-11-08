#!/usr/bin/env node
// Validates content/patterns/*.json against the Pattern data contract.
// Zero dependencies on purpose: runs in CI with plain Node (>=18) and no install step.
// explanation_ja is optional in the app-facing contract but required here so shipped content is complete.
// Each file may hold a single Pattern object or an array of Patterns.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "patterns");
const CATEGORIES = ["docs", "saas-ui", "dev-comm"];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BLANK = "____";

const errors = [];
const seen = new Map();
const answerHist = {};
const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isIdx = (v, len) => Number.isInteger(v) && v >= 0 && v < len;

function checkChoices(err, choices, answer, min = 3, max = 4) {
  if (!Array.isArray(choices) || !choices.every(isStr)) {
    err("choices must be an array of non-empty strings");
    return;
  }
  if (choices.length < min || choices.length > max) err(`choices length must be ${min}-${max} (got ${choices.length})`);
  if (new Set(choices.map((c) => c.trim().toLowerCase())).size !== choices.length) err("choices contain duplicates");
  if (!isIdx(answer, choices.length)) err(`answer ${JSON.stringify(answer)} is out of range 0..${choices.length - 1}`);
  else answerHist[answer] = (answerHist[answer] ?? 0) + 1;
}

function checkPattern(p, where) {
  const err = (m) => errors.push(`${where}: ${m}`);
  if (typeof p !== "object" || p === null || Array.isArray(p)) return err("pattern must be an object");

  if (!isStr(p.id) || !KEBAB.test(p.id)) err(`id must be kebab-case string (got ${JSON.stringify(p.id)})`);
  else if (seen.has(p.id)) err(`duplicate id "${p.id}" (also in ${seen.get(p.id)})`);
  else seen.set(p.id, where);

  if (!CATEGORIES.includes(p.category)) err(`category must be one of ${CATEGORIES.join("|")}`);
  else counts[p.category]++;

  for (const k of ["source", "pattern", "meaning_ja", "example_en", "example_ja"]) {
    if (!isStr(p[k])) err(`${k} is required (non-empty string)`);
  }
  if (p.note_ja !== undefined && !isStr(p.note_ja)) err("note_ja must be a non-empty string when present");
  if (![1, 2, 3].includes(p.level)) err("level must be 1, 2 or 3");

  for (const k of Object.keys(p)) {
    if (!["id", "category", "source", "pattern", "meaning_ja", "example_en", "example_ja", "note_ja", "drills", "level"].includes(k)) {
      err(`unknown field "${k}"`);
    }
  }

  if (!Array.isArray(p.drills) || p.drills.length < 2) return err("drills must have at least 2 entries");
  p.drills.forEach((d, i) => {
    const derr = (m) => err(`drills[${i}]: ${m}`);
    if (typeof d !== "object" || d === null) return derr("must be an object");
    if (!isStr(d.explanation_ja)) derr("explanation_ja is required (non-empty string)");
    for (const k of Object.keys(d)) {
      if (!["type", "prompt_en", "choices_ja", "sentence_en", "choices_en", "answer", "explanation_ja"].includes(k)) derr(`unknown field "${k}"`);
    }
    if (d.type === "choice") {
      if (!isStr(d.prompt_en)) derr("prompt_en is required");
      checkChoices(derr, d.choices_ja, d.answer);
    } else if (d.type === "cloze") {
      if (!isStr(d.sentence_en)) derr("sentence_en is required");
      else if (d.sentence_en.split(BLANK).length - 1 !== 1) derr(`sentence_en must contain exactly one "${BLANK}"`);
      checkChoices(derr, d.choices_en, d.answer);
    } else {
      derr(`type must be "choice" or "cloze" (got ${JSON.stringify(d.type)})`);
    }
  });
}

const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) errors.push("no pattern files found in content/patterns");

for (const f of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(dir, f), "utf8"));
  } catch (e) {
    errors.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  (Array.isArray(data) ? data : [data]).forEach((p, i) =>
    checkPattern(p, Array.isArray(data) ? `${f}[${i}]${p?.id ? ` (${p.id})` : ""}` : f),
  );
}

if (errors.length) {
  console.error(`content validation failed (${errors.length} error${errors.length > 1 ? "s" : ""}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
// Guards against authoring the correct choice first everywhere (answer position leak).
const drillCount = Object.values(answerHist).reduce((a, b) => a + b, 0);
for (const [idx, n] of Object.entries(answerHist)) {
  if (drillCount >= 20 && n / drillCount > 0.5) errors.push(`answer index ${idx} used by ${n}/${drillCount} drills; shuffle choices`);
}
if (errors.length) {
  console.error(`content validation failed (${errors.length} error${errors.length > 1 ? "s" : ""}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`OK: ${total} patterns (${CATEGORIES.map((c) => `${c}=${counts[c]}`).join(", ")}) in ${files.length} file(s)`);
