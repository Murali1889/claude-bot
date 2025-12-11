/**
 * AES-256-GCM Encryption Module
 * Used for encrypting Anthropic API keys at rest
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;
const SALT = "claude-bot-salt-v1"; // Static salt for key derivation

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} plaintext - The text to encrypt (e.g., API key)
 * @param {string} encryptionKey - The master encryption key from env
 * @returns {Object} - { encrypted, iv, authTag } all base64 encoded
 */
function encrypt(plaintext, encryptionKey) {
  if (!plaintext || !encryptionKey) {
    throw new Error("Plaintext and encryption key are required");
  }

  // Derive a 256-bit key from the encryption key
  const key = crypto.scryptSync(encryptionKey, SALT, 32);

  // Generate random IV for each encryption (critical for GCM security)
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param {string} encrypted - Base64 encoded ciphertext
 * @param {string} iv - Base64 encoded initialization vector
 * @param {string} authTag - Base64 encoded authentication tag
 * @param {string} encryptionKey - The master encryption key from env
 * @returns {string} - The decrypted plaintext
 */
function decrypt(encrypted, iv, authTag, encryptionKey) {
  if (!encrypted || !iv || !authTag || !encryptionKey) {
    throw new Error("All parameters are required for decryption");
  }

  // Derive the same key used for encryption
  const key = crypto.scryptSync(encryptionKey, SALT, 32);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64"),
    { authTagLength: AUTH_TAG_LENGTH }
  );

  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a secure random encryption key
 * @returns {string} - 32-byte hex encoded key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validate that an encryption key is properly formatted
 * @param {string} key - The key to validate
 * @returns {boolean}
 */
function isValidEncryptionKey(key) {
  return typeof key === "string" && key.length >= 32;
}

module.exports = {
  encrypt,
  decrypt,
  generateEncryptionKey,
  isValidEncryptionKey,
};
