#!/usr/bin/env node
// @ts-check

// Reads the raw MongoDB fixtures and runs them through normalization
// to produce clean domain-model JSON files for comparison.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { physicianToDomain, locumJobToDomain, reservationToDomain } from "../src/normalization/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../fixtures");

// --- Load raw fixtures ---
const rawUsers = JSON.parse(readFileSync(resolve(fixturesDir, "locum.users.formatted.json"), "utf-8"));
const rawJobs = JSON.parse(readFileSync(resolve(fixturesDir, "locum.locumjobs.formatted.json"), "utf-8"));
const rawReservations = JSON.parse(readFileSync(resolve(fixturesDir, "locum.reservations.formatted.json"), "utf-8"));

// --- Normalize ---
const physicians = rawUsers.map((raw) => physicianToDomain(raw));
const locumJobs = rawJobs.map((raw) => locumJobToDomain(raw));
const reservations = rawReservations.map((raw) => reservationToDomain(raw));

// --- Write normalized fixtures ---
writeFileSync(resolve(fixturesDir, "normalized.physicians.json"), JSON.stringify(physicians, null, 2) + "\n");
writeFileSync(resolve(fixturesDir, "normalized.locumjobs.json"), JSON.stringify(locumJobs, null, 2) + "\n");
writeFileSync(resolve(fixturesDir, "normalized.reservations.json"), JSON.stringify(reservations, null, 2) + "\n");

console.log(`Normalized ${physicians.length} physicians, ${locumJobs.length} locum jobs, ${reservations.length} reservations`);
console.log("Output files:");
console.log("  fixtures/normalized.physicians.json");
console.log("  fixtures/normalized.locumjobs.json");
console.log("  fixtures/normalized.reservations.json");
