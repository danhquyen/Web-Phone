// Generates a self-signed TLS certificate for local HTTPS development.
// Cross-platform (no openssl needed). Idempotent: skips if certs already exist.
//
//   node scripts/generate-cert.mjs
//
// Output: certs/key.pem and certs/cert.pem (gitignored).
// WebRTC needs a secure context, so the test pages must be served over HTTPS
// (or http://localhost). This cert is self-signed: your browser will warn the
// first time — accept it (Advanced -> Proceed) to continue.

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import selfsigned from "selfsigned";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const certDir = join(root, "certs");
const keyPath = join(certDir, "key.pem");
const certPath = join(certDir, "cert.pem");

if (existsSync(keyPath) && existsSync(certPath)) {
    console.log("Certificate already exists at certs/ — skipping generation.");
    process.exit(0);
}

mkdirSync(certDir, { recursive: true });

const attrs = [{ name: "commonName", value: "localhost" }];
const pems = await selfsigned.generate(attrs, {
    days: 825,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
        { name: "basicConstraints", cA: false },
        {
            name: "subjectAltName",
            altNames: [
                { type: 2, value: "localhost" },     // DNS
                { type: 7, ip: "127.0.0.1" },          // IP
                { type: 7, ip: "::1" }                 // IPv6 loopback
            ]
        }
    ]
});

writeFileSync(keyPath, pems.private);
writeFileSync(certPath, pems.cert);
console.log("Generated self-signed certificate:");
console.log("  " + keyPath);
console.log("  " + certPath);
