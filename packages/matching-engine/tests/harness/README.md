# Matching Harness

This is a test harness around the matching engine. It loads the JSON fixtures (`jobs`, `users`, `reservations`), runs the stub matching engine, and writes a CSV file.

---

## How to run

Install dependencies:

```bash
npm install
```

Run the harness (defaults):

```bash
npm run test:harness
```

Run with options (flags pass through):

```bash
npx matching-harness --topK 5 --seed 42
```

Run the automated tests for the harness:

```bash
npm test
```

The CSV output is written to: `./artifacts/matching_test_results_<timestamp>.csv`

---

Supported flags:

| Flag                    | Type   | Default       | Description                                    |
| ----------------------- | ------ | ------------- | ---------------------------------------------- |
| `--maxJobs <number>`    | number | `25`          | Max number of jobs to include in the run       |
| `--maxUsers <number>`   | number | `1000`        | Max number of users to consider as candidates  |
| `--topK <number>`       | number | `10`          | Top physicians to include per job in the CSV   |
| `--seed <number>`       | number | _random_      | Seed for deterministic sampling                |
| `--jobFilter <type>`    | string | _none_        | `"short-term"` or `"long-term"`                |
| `--outputDir <path>`    | string | `./artifacts` | Directory where the CSV will be written        |
| `--jobs <path>`         | string | fixtures path | Override path to the jobs JSON fixture         |
| `--users <path>`        | string | fixtures path | Override path to the users JSON fixture        |
| `--reservations <path>` | string | fixtures path | Override path to the reservations JSON fixture |
