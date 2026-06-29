// Shared limits used by both the client (pre-push size check in io/storage.js) and the Cloudflare
// Worker (server-side validation in src/index.js), so the ceiling can't drift between the two.
export const MAX_BLOB = 256_000; // encrypted-blob ceiling; real blobs are ~1 KB avg, ~11 KB max (gzipped)
