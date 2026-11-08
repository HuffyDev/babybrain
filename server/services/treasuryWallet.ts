import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { treasuryWallet } from "../db/schema";
import { env } from "../env";

/**
 * Treasury key imported from the /admin Operator Console.
 *
 * The secret key is stored AES-256-GCM encrypted (key = scrypt(WALLET_ENCRYPTION_KEY, per-row salt), pubkey bound as
 * associated data), so a database dump alone cannot spend from the treasury. The decrypted key is only ever handed to
 * the live executor (adapters/live/executor.ts) via `importedTreasuryKeypair()`; nothing here returns or logs it.
 *
 * An imported key takes precedence over TREASURY_PUBKEY / TREASURY_PRIVATE_KEY from the environment.
 */

type Row = typeof treasuryWallet.$inferSelect;
let row: Row | null = null;
let version = 0;

export const MIN_ENCRYPTION_KEY_LENGTH = 32;
export const encryptionConfigured = () => (env.WALLET_ENCRYPTION_KEY?.length ?? 0) >= MIN_ENCRYPTION_KEY_LENGTH;

function deriveKey(salt: Buffer): Buffer {
  if (!encryptionConfigured()) throw new Error(`WALLET_ENCRYPTION_KEY must be set (at least ${MIN_ENCRYPTION_KEY_LENGTH} characters)`);
  return scryptSync(env.WALLET_ENCRYPTION_KEY!, salt, 32);
}

/** Accepts a base58 secret key (Phantom/Solflare "Export Private Key"), a base58 32-byte seed, or a solana-keygen JSON array. */
export function parseSecretKey(input: string): Keypair {
  const s = input.trim();
  let bytes: Uint8Array;
  if (s.startsWith("[")) {
    let arr: unknown;
    try {
      arr = JSON.parse(s);
    } catch {
      throw new Error("invalid JSON key array");
    }
    if (!Array.isArray(arr) || !arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) throw new Error("key array must contain bytes 0–255");
    bytes = Uint8Array.from(arr as number[]);
  } else {
    try {
      bytes = bs58.decode(s);
    } catch {
      throw new Error("not a valid base58 private key");
    }
  }
  try {
    if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
    if (bytes.length === 32) return Keypair.fromSeed(bytes);
  } catch {
    throw new Error("private key is corrupted (embedded public key does not match)");
  }
  throw new Error(`private key must be 64 bytes (or a 32-byte seed), got ${bytes.length}`);
}

export function encryptSecret(kp: Keypair) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const pubkey = kp.publicKey.toBase58();
  const cipher = createCipheriv("aes-256-gcm", deriveKey(salt), iv);
  cipher.setAAD(Buffer.from(pubkey));
  const ciphertext = Buffer.concat([cipher.update(kp.secretKey), cipher.final()]);
  return { pubkey, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function decryptSecret(r: Pick<Row, "pubkey" | "salt" | "iv" | "tag" | "ciphertext">): Keypair {
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(Buffer.from(r.salt, "base64")), Buffer.from(r.iv, "base64"));
  decipher.setAAD(Buffer.from(r.pubkey));
  decipher.setAuthTag(Buffer.from(r.tag, "base64"));
  let secret: Buffer;
  try {
    secret = Buffer.concat([decipher.update(Buffer.from(r.ciphertext, "base64")), decipher.final()]);
  } catch {
    throw new Error("imported treasury key cannot be decrypted — was WALLET_ENCRYPTION_KEY changed? Re-import the key from /admin");
  }
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret)); // copy: Keypair keeps a reference to the bytes it is given
  secret.fill(0);
  if (kp.publicKey.toBase58() !== r.pubkey) throw new Error("imported treasury key does not match its stored pubkey");
  return kp;
}

/** Boot: cache the (still encrypted) imported key, if any. */
export async function loadTreasuryWallet() {
  const [r] = await db.select().from(treasuryWallet).where(eq(treasuryWallet.id, 1));
  row = r ?? null;
  version++;
  if (row && !encryptionConfigured()) console.warn(`[treasury] an imported key exists for ${row.pubkey} but WALLET_ENCRYPTION_KEY is not set — it cannot be used until it is`);
}

/** The treasury address in use: imported key first, else TREASURY_PUBKEY. */
export function treasuryPubkey(): string | null {
  return row?.pubkey ?? env.TREASURY_PUBKEY ?? null;
}

/** Bumped whenever the imported key changes, so the executor can drop its cached Keypair. */
export const treasuryKeyVersion = () => version;

/** Only for adapters/live/executor.ts. Null when no key has been imported. */
export function importedTreasuryKeypair(): Keypair | null {
  return row ? decryptSecret(row) : null;
}

export function treasuryWalletStatus() {
  return {
    pubkey: treasuryPubkey(),
    source: row ? ("imported" as const) : env.TREASURY_PUBKEY ? ("env" as const) : null,
    importedAt: row?.importedAt.toISOString() ?? null,
    envPubkey: env.TREASURY_PUBKEY ?? null,
    encryptionConfigured: encryptionConfigured(),
  };
}

export async function importTreasuryKey(secret: string): Promise<{ pubkey: string; previous: string | null }> {
  const kp = parseSecretKey(secret);
  const enc = encryptSecret(kp);
  decryptSecret(enc); // round-trip before persisting
  const previous = treasuryPubkey();
  const values = { id: 1, ...enc, importedAt: new Date() };
  const [r] = await db.insert(treasuryWallet).values(values).onConflictDoUpdate({ target: treasuryWallet.id, set: values }).returning();
  row = r;
  version++;
  return { pubkey: enc.pubkey, previous };
}

export async function removeImportedTreasuryKey(): Promise<{ removed: string | null; now: string | null }> {
  const removed = row?.pubkey ?? null;
  await db.delete(treasuryWallet).where(eq(treasuryWallet.id, 1));
  row = null;
  version++;
  return { removed, now: treasuryPubkey() };
}
