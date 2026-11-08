import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "../env";
import { decryptSecret, encryptSecret, parseSecretKey } from "../services/treasuryWallet";

(env as { WALLET_ENCRYPTION_KEY?: string }).WALLET_ENCRYPTION_KEY = "a".repeat(64);

describe("treasury wallet import", () => {
  const kp = Keypair.generate();

  it("parses base58 secret keys, 32-byte seeds and solana-keygen JSON arrays", () => {
    expect(parseSecretKey(bs58.encode(kp.secretKey)).publicKey.equals(kp.publicKey)).toBe(true);
    expect(parseSecretKey(`  ${bs58.encode(kp.secretKey)}\n`).publicKey.equals(kp.publicKey)).toBe(true);
    expect(parseSecretKey(JSON.stringify(Array.from(kp.secretKey))).publicKey.equals(kp.publicKey)).toBe(true);
    expect(parseSecretKey(bs58.encode(kp.secretKey.slice(0, 32))).publicKey.equals(kp.publicKey)).toBe(true);
  });

  it("rejects malformed keys without echoing them", () => {
    const bad = bs58.encode(kp.secretKey.slice(0, 40));
    expect(() => parseSecretKey(bad)).toThrow(/64 bytes/);
    try {
      parseSecretKey(bad);
    } catch (e) {
      expect(String(e)).not.toContain(bad);
    }
    expect(() => parseSecretKey("0OIl-not-base58")).toThrow(/base58/);
    expect(() => parseSecretKey("[1,2,300]")).toThrow(/bytes/);
    const tampered = Uint8Array.from(kp.secretKey);
    tampered[63] ^= 1; // embedded pubkey no longer matches the seed
    expect(() => parseSecretKey(bs58.encode(tampered))).toThrow();
  });

  it("round-trips through AES-GCM and never stores the plaintext", () => {
    const enc = encryptSecret(kp);
    expect(enc.pubkey).toBe(kp.publicKey.toBase58());
    expect(JSON.stringify(enc)).not.toContain(bs58.encode(kp.secretKey));
    expect(Buffer.from(enc.ciphertext, "base64").equals(Buffer.from(kp.secretKey))).toBe(false);
    expect(decryptSecret(enc).publicKey.equals(kp.publicKey)).toBe(true);
  });

  it("fails closed on tampering, a swapped pubkey, or a different encryption key", () => {
    const enc = encryptSecret(kp);
    const ct = Buffer.from(enc.ciphertext, "base64");
    ct[0] ^= 1;
    expect(() => decryptSecret({ ...enc, ciphertext: ct.toString("base64") })).toThrow(/cannot be decrypted/);
    expect(() => decryptSecret({ ...enc, pubkey: Keypair.generate().publicKey.toBase58() })).toThrow(/cannot be decrypted/);
    (env as { WALLET_ENCRYPTION_KEY?: string }).WALLET_ENCRYPTION_KEY = "b".repeat(64);
    expect(() => decryptSecret(enc)).toThrow(/WALLET_ENCRYPTION_KEY/);
    (env as { WALLET_ENCRYPTION_KEY?: string }).WALLET_ENCRYPTION_KEY = "a".repeat(64);
  });

  it("refuses to encrypt without a strong enough WALLET_ENCRYPTION_KEY", () => {
    (env as { WALLET_ENCRYPTION_KEY?: string }).WALLET_ENCRYPTION_KEY = "short";
    expect(() => encryptSecret(kp)).toThrow(/at least 32/);
    (env as { WALLET_ENCRYPTION_KEY?: string }).WALLET_ENCRYPTION_KEY = "a".repeat(64);
  });
});
