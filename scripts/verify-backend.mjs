#!/usr/bin/env node
/**
 * CareerTrack backend verification
 *
 * Checks the four things a reviewer will care about:
 *   1. User data is isolated (user B cannot read or change user A's data)
 *   2. Invalid, forged and tampered tokens are rejected
 *   3. Request validation works (bad input gets a 4xx, never a 2xx or 5xx)
 *   4. Errors do not expose stack traces, database details or secrets
 *
 * Usage (Node 18+, no dependencies):
 *   BASE_URL=http://localhost:5000 node scripts/verify-backend.mjs
 *   BASE_URL=https://your-api.onrender.com node scripts/verify-backend.mjs
 *
 * It creates two throwaway users (verify.a.<time>@example.com and
 * verify.b.<time>@example.com) and removes the records it creates.
 * Delete those two users from the database afterwards.
 * Do not point this at a database you cannot afford to add two test users to.
 *
 * Exit code: 0 if nothing FAILED (warnings are allowed), 1 otherwise.
 */

import crypto from "node:crypto";

const BASE = (process.env.BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const results = [];
const errorBodies = [];

/* ---------------------------------------------------------------- helpers */

const b64url = (value) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString(
    "base64url"
  );

const decodePayload = (token) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

function signToken(payload, secret) {
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const body = b64url(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

async function call(method, path, { token, body, raw, headers = {} } = {}) {
  const hasBody = body !== undefined || raw !== undefined;

  let response;

  try {
    response = await fetch(BASE + path, {
      method,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: hasBody ? (raw !== undefined ? raw : JSON.stringify(body)) : undefined,
    });
  } catch (error) {
    // The server closed the connection (some servers do this for huge bodies).
    return {
      status: 0,
      json: null,
      text: "",
      headers: new Headers(),
      networkError: error.message,
    };
  }

  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }

  if (response.status >= 400) {
    errorBodies.push({ where: `${method} ${path}`, status: response.status, text });
  }

  return { status: response.status, json, text, headers: response.headers };
}

function record(level, group, name, detail = "") {
  results.push({ level, group, name, detail });
  const tag = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN" }[level];
  console.log(`  ${tag}  ${name}${detail ? `  (${detail})` : ""}`);
}

const pass = (group, name, detail) => record("PASS", group, name, detail);
const fail = (group, name, detail) => record("FAIL", group, name, detail);
const warn = (group, name, detail) => record("WARN", group, name, detail);

function check(group, name, ok, detail) {
  (ok ? pass : fail)(group, name, ok ? undefined : detail);
}

const isRejected = (status) => status === 401 || status === 403;
const isClientError = (status) => status >= 400 && status < 500;
const isSuccess = (status) => status >= 200 && status < 300;

function section(title) {
  console.log(`\n${title}`);
}

/* ------------------------------------------------------------------ setup */

async function createUser(label, stamp) {
  const email = `verify.${label}.${stamp}@example.com`;
  const password = "Verify-Passw0rd!";

  const registration = await call("POST", "/api/auth/register", {
    body: { name: `Verify ${label.toUpperCase()}`, email, password },
  });

  const login = await call("POST", "/api/auth/login", {
    body: { email, password },
  });

  return { email, password, registration, login, token: login.json?.token };
}

/* ------------------------------------------------------------------ checks */

async function main() {
  console.log(`CareerTrack backend verification\nTarget: ${BASE}`);

  try {
    await fetch(BASE + "/api/auth/login", { method: "OPTIONS" });
  } catch (error) {
    console.error(`\nCould not reach ${BASE}: ${error.message}`);
    console.error("Start the backend (or fix BASE_URL) and run again.");
    process.exit(2);
  }

  const stamp = Date.now();
  const A = await createUser("a", stamp);
  const B = await createUser("b", stamp);

  if (!A.token || !B.token) {
    console.error(
      "\nCould not register and log in the two test users, so nothing else can be checked."
    );
    console.error("Register status:", A.registration.status, A.registration.text.slice(0, 200));
    console.error("Login status:   ", A.login.status, A.login.text.slice(0, 200));
    process.exit(2);
  }

  const aPayload = decodePayload(A.token);
  const bPayload = decodePayload(B.token);
  const bId = bPayload.userId || bPayload.id || bPayload._id || bPayload.sub;

  /* ---- 1. Tokens ---- */
  section("Tokens");

  const protectedPath = "/api/applications";

  let r = await call("GET", protectedPath);
  check("tokens", "No token is rejected", isRejected(r.status), `got ${r.status}`);

  r = await call("GET", protectedPath, { token: "not-a-jwt" });
  check("tokens", "Malformed token is rejected", isRejected(r.status), `got ${r.status}`);

  r = await call("GET", protectedPath, {
    headers: { Authorization: "Token abc.def.ghi" },
  });
  check("tokens", "Wrong auth scheme is rejected", isRejected(r.status), `got ${r.status}`);

  r = await call("GET", protectedPath, {
    token: signToken(aPayload, "not-the-real-secret"),
  });
  check(
    "tokens",
    "Token signed with a different secret is rejected",
    isRejected(r.status),
    `got ${r.status}`
  );

  const [headerA, , signatureA] = A.token.split(".");
  r = await call("GET", protectedPath, {
    token: `${headerA}.${b64url(bPayload)}.${signatureA}`,
  });
  check(
    "tokens",
    "Token with a swapped payload (A's signature, B's identity) is rejected",
    isRejected(r.status),
    `got ${r.status}`
  );

  r = await call("GET", protectedPath, {
    token: `${b64url({ alg: "none", typ: "JWT" })}.${b64url(aPayload)}.`,
  });
  check(
    "tokens",
    'Unsigned token ("alg": "none") is rejected',
    isRejected(r.status),
    `got ${r.status}`
  );

  r = await call("GET", protectedPath, { token: A.token });
  check("tokens", "A valid token is accepted", r.status === 200, `got ${r.status}`);

  /* ---- 2. Data isolation ---- */
  section("Data isolation");

  const created = await call("POST", "/api/applications", {
    token: A.token,
    body: { company: "Isolation Co", role: "Tester", status: "Applied" },
  });
  const appId = created.json?.application?._id;

  check(
    "isolation",
    "User A can create an application",
    isSuccess(created.status) && Boolean(appId),
    `status ${created.status}`
  );

  if (appId) {
    r = await call("GET", "/api/applications", { token: B.token });
    const bSeesIt = (r.json?.applications || []).some((item) => item._id === appId);
    check("isolation", "User B's list does not include A's application", !bSeesIt);

    r = await call("PUT", `/api/applications/${appId}`, {
      token: B.token,
      body: { company: "Hijacked", role: "Hijacked", status: "Rejected" },
    });
    check(
      "isolation",
      "User B cannot update A's application",
      !isSuccess(r.status),
      `got ${r.status}`
    );

    r = await call("DELETE", `/api/applications/${appId}`, { token: B.token });
    check(
      "isolation",
      "User B cannot delete A's application",
      !isSuccess(r.status),
      `got ${r.status}`
    );

    r = await call("GET", "/api/applications", { token: A.token });
    const stillThere = (r.json?.applications || []).find((item) => item._id === appId);
    check(
      "isolation",
      "A's application is unchanged after B's attempts",
      Boolean(stillThere) && stillThere.company === "Isolation Co",
      stillThere ? `company is now "${stillThere.company}"` : "record is gone"
    );

    // Mass assignment: A must not be able to create a record owned by B.
    if (bId) {
      const sneaky = await call("POST", "/api/applications", {
        token: A.token,
        body: { company: "Owner Swap", role: "Tester", status: "Wishlist", user: bId },
      });
      const sneakyId = sneaky.json?.application?._id;

      if (sneakyId) {
        r = await call("GET", "/api/applications", { token: B.token });
        const leaked = (r.json?.applications || []).some((item) => item._id === sneakyId);
        check(
          "isolation",
          'A cannot assign a record to B by sending a "user" field',
          !leaked
        );
        await call("DELETE", `/api/applications/${sneakyId}`, { token: A.token });
      } else {
        pass("isolation", 'A "user" field in the request body is ignored or rejected');
      }
    }
  }

  // Weekly goal
  r = await call("PUT", "/api/goals", { token: A.token, body: { weeklyApplicationTarget: 7 } });
  const bGoal = await call("GET", "/api/goals", { token: B.token });
  check(
    "isolation",
    "User B's weekly goal is not A's goal",
    r.status === 200 && bGoal.json?.goal?.weeklyApplicationTarget !== 7,
    `B sees ${bGoal.json?.goal?.weeklyApplicationTarget}`
  );

  // Interview preparation (uses its own application so earlier failures cannot cascade)
  const prepApp = await call("POST", "/api/applications", {
    token: A.token,
    body: { company: "Prep Co", role: "Tester", status: "Interview" },
  });
  const prepId = prepApp.json?.application?._id;

  if (prepId) {
    r = await call("POST", `/api/interview-preparation/${prepId}`, { token: A.token, body: {} });
    check(
      "isolation",
      "User A can create a preparation workspace",
      isSuccess(r.status),
      `status ${r.status}`
    );

    for (const [method, body] of [["GET"], ["PUT", { preparationNotes: "hijack" }], ["DELETE"]]) {
      r = await call(method, `/api/interview-preparation/${prepId}`, { token: B.token, body });
      check(
        "isolation",
        `User B cannot ${method} A's preparation workspace`,
        !isSuccess(r.status),
        `got ${r.status}`
      );
    }

    await call("DELETE", `/api/interview-preparation/${prepId}`, { token: A.token });
    await call("DELETE", `/api/applications/${prepId}`, { token: A.token });
  }

  // Notes
  const noteTitle = `Verify note ${stamp}`;
  await call("POST", "/api/notes", {
    token: A.token,
    body: { title: noteTitle, content: "Private note" },
  });

  r = await call("GET", "/api/notes", { token: A.token });
  const note = (r.json?.notes || []).find((item) => item.title === noteTitle);
  check("isolation", "User A can create and list a note", Boolean(note));

  if (note) {
    r = await call("GET", "/api/notes", { token: B.token });
    check(
      "isolation",
      "User B's notes do not include A's note",
      !(r.json?.notes || []).some((item) => item._id === note._id)
    );

    r = await call("PUT", `/api/notes/${note._id}`, {
      token: B.token,
      body: { title: "Hijacked", content: "Hijacked" },
    });
    check("isolation", "User B cannot update A's note", !isSuccess(r.status), `got ${r.status}`);

    r = await call("DELETE", `/api/notes/${note._id}`, { token: B.token });
    check("isolation", "User B cannot delete A's note", !isSuccess(r.status), `got ${r.status}`);

    await call("DELETE", `/api/notes/${note._id}`, { token: A.token });
  }

  /* ---- 3. Validation ---- */
  section("Request validation");

  const badBodies = [
    ["Missing company", { role: "Tester", status: "Applied" }],
    ["Missing role", { company: "Co", status: "Applied" }],
    ["Invalid status value", { company: "Co", role: "Tester", status: "Hacked" }],
    ["Company sent as an object (NoSQL operator)", { company: { $gt: "" }, role: "Tester" }],
    ["Deadline that is not a date", { company: "Co", role: "Tester", deadline: "not-a-date" }],
  ];

  for (const [name, body] of badBodies) {
    r = await call("POST", "/api/applications", { token: A.token, body });
    const ok = isClientError(r.status);

    if (isSuccess(r.status)) {
      const strayId = r.json?.application?._id;
      if (strayId) await call("DELETE", `/api/applications/${strayId}`, { token: A.token });
    }

    check("validation", `${name} gets a 4xx`, ok, `got ${r.status}`);
  }

  r = await call("PUT", "/api/applications/not-an-object-id", {
    token: A.token,
    body: { company: "Co", role: "Tester" },
  });
  check(
    "validation",
    "Invalid record ID gets a 4xx, not a server error",
    isClientError(r.status),
    `got ${r.status}`
  );

  for (const value of [0, 101, "abc", 2.5, null, -3]) {
    r = await call("PUT", "/api/goals", {
      token: A.token,
      body: { weeklyApplicationTarget: value },
    });
    check(
      "validation",
      `Weekly goal ${JSON.stringify(value)} is rejected`,
      isClientError(r.status),
      `got ${r.status}`
    );
  }

  r = await call("POST", "/api/auth/login", {
    body: { email: { $gt: "" }, password: { $gt: "" } },
  });
  check(
    "validation",
    "Login with NoSQL operators does not return a token",
    !r.json?.token && !isSuccess(r.status),
    `got ${r.status}`
  );

  r = await call("POST", "/api/auth/register", {
    body: { name: "No Password", email: `nopass.${stamp}@example.com` },
  });
  check(
    "validation",
    "Registration without a password gets a 4xx",
    isClientError(r.status),
    `got ${r.status}`
  );

  r = await call("POST", "/api/auth/register", {
    body: { name: A.email, email: A.email, password: A.password },
  });
  check(
    "validation",
    "Registering an existing email gets a 4xx",
    isClientError(r.status),
    `got ${r.status}`
  );

  r = await call("POST", "/api/applications", { token: A.token, raw: "{ this is not json" });
  check(
    "validation",
    "Malformed JSON gets a 4xx",
    isClientError(r.status),
    `got ${r.status}`
  );

  r = await call("POST", "/api/notes", {
    token: A.token,
    body: { title: "Huge", content: "x".repeat(1_500_000) },
  });
  if (isSuccess(r.status)) {
    warn(
      "validation",
      "A 1.5 MB note was accepted",
      "consider limiting request size, e.g. express.json({ limit: '100kb' })"
    );
    const huge = (await call("GET", "/api/notes", { token: A.token })).json?.notes?.find(
      (item) => item.title === "Huge"
    );
    if (huge) await call("DELETE", `/api/notes/${huge._id}`, { token: A.token });
  } else {
    pass("validation", "An oversized request body is rejected");
  }

  /* ---- 4. Error and response hygiene ---- */
  section("Error and response hygiene");

  const unknown = await call("POST", "/api/auth/login", {
    body: { email: `nobody.${stamp}@example.com`, password: "Wrong-Passw0rd!" },
  });
  const wrongPassword = await call("POST", "/api/auth/login", {
    body: { email: A.email, password: "Wrong-Passw0rd!" },
  });

  if (
    unknown.status === wrongPassword.status &&
    unknown.json?.message === wrongPassword.json?.message
  ) {
    pass("hygiene", "Login errors are identical for unknown email and wrong password");
  } else {
    warn(
      "hygiene",
      "Login errors differ for unknown email vs wrong password",
      `"${unknown.json?.message}" vs "${wrongPassword.json?.message}". This lets attackers discover which emails are registered`
    );
  }

  const hashPattern = /\$2[aby]\$\d{2}\$/;
  const leaksPassword = [A.registration, A.login].some(
    (response) => hashPattern.test(response.text) || /"password"\s*:/.test(response.text)
  );
  check(
    "hygiene",
    "Register and login responses do not contain a password or hash",
    !leaksPassword
  );

  const hardLeaks = [
    [/node_modules/i, "file paths from node_modules"],
    [/\bat\s+[^\s(]+\s+\([^)]*:\d+:\d+\)/, "a stack trace"],
    [/"stack"\s*:/, 'a "stack" field'],
    [/mongodb(\+srv)?:\/\//i, "a database connection string"],
    [/E11000/, "a raw MongoDB duplicate-key error"],
    [/MongoServerError|MongoNetworkError/, "a MongoDB driver error"],
    [/process\.env|JWT_SECRET/i, "an environment variable name"],
  ];

  const softLeaks = [
    [/CastError|BSONError/, "a Mongoose cast error"],
    [/ValidationError|Path `/, "raw Mongoose validation text"],
    [/JsonWebTokenError|jwt malformed|invalid signature|jwt expired/i, "raw jsonwebtoken messages"],
  ];

  const hardFound = new Map();
  const softFound = new Map();

  for (const entry of errorBodies) {
    for (const [pattern, label] of hardLeaks) {
      if (pattern.test(entry.text)) hardFound.set(label, entry.where);
    }
    for (const [pattern, label] of softLeaks) {
      if (pattern.test(entry.text)) softFound.set(label, entry.where);
    }
  }

  if (hardFound.size === 0) {
    pass("hygiene", `No stack traces, paths, secrets or DB details in ${errorBodies.length} error responses`);
  } else {
    for (const [label, where] of hardFound) {
      fail("hygiene", `An error response exposes ${label}`, `first seen on ${where}`);
    }
  }

  for (const [label, where] of softFound) {
    warn(
      "hygiene",
      `An error response contains ${label}`,
      `first seen on ${where}. Return a short generic message instead`
    );
  }

  const probe = await call("GET", "/api/applications", { token: A.token });

  if (probe.headers.get("x-powered-by")) {
    warn("hygiene", 'The "X-Powered-By" header is present', "use app.disable('x-powered-by') or helmet()");
  } else {
    pass("hygiene", 'No "X-Powered-By" header');
  }

  const cors = await call("GET", "/api/applications", {
    token: A.token,
    headers: { Origin: "https://evil.example" },
  });
  const allowed = cors.headers.get("access-control-allow-origin");

  if (allowed === "*" || allowed === "https://evil.example") {
    warn(
      "hygiene",
      "CORS allows an arbitrary origin",
      "restrict it to your frontend URL in production"
    );
  } else {
    pass("hygiene", "CORS does not allow an arbitrary origin");
  }

  /* ---- cleanup ---- */
  if (appId) await call("DELETE", `/api/applications/${appId}`, { token: A.token });

  /* ---- summary ---- */
  const count = (level) => results.filter((item) => item.level === level).length;

  console.log(
    `\nResult: ${count("PASS")} passed, ${count("WARN")} warnings, ${count("FAIL")} failed`
  );
  console.log(
    `Remember to delete the test users from the database: ${A.email} and ${B.email}`
  );

  if (count("FAIL") > 0) {
    console.log("\nFailures to fix before you deploy or describe this on a resume:");
    for (const item of results.filter((entry) => entry.level === "FAIL")) {
      console.log(`  - ${item.name}${item.detail ? ` (${item.detail})` : ""}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nVerification crashed:", error);
  process.exit(2);
});
