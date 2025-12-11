/**
 * API Key Service
 * Handles encryption, validation, and management of Anthropic API keys
 */

const { encrypt, decrypt } = require("./encryption");
const {
  saveApiKey,
  getApiKey,
  updateApiKeyStatus,
  incrementApiKeyFailure,
  getInstallation,
} = require("./supabase");

/**
 * Validate an Anthropic API key by making a test request
 * @param {string} apiKey - The API key to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
async function validateAnthropicKey(apiKey) {
  // Check format first
  if (!apiKey || typeof apiKey !== "string") {
    return { valid: false, error: "API key is required" };
  }

  // Anthropic API keys start with "sk-ant-"
  if (!apiKey.startsWith("sk-ant-")) {
    return { valid: false, error: "Invalid API key format. Key should start with 'sk-ant-'" };
  }

  try {
    // Make a minimal API call to validate the key
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const errorData = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return { valid: false, error: "Invalid API key" };
    }

    if (response.status === 429) {
      // Rate limited but key is valid
      return { valid: true, warning: "Rate limited - key appears valid" };
    }

    if (response.status === 400) {
      // Bad request but authenticated - key is valid
      return { valid: true };
    }

    return {
      valid: false,
      error: errorData.error?.message || `Validation failed with status ${response.status}`,
    };
  } catch (error) {
    console.error("Error validating API key:", error);
    return { valid: false, error: "Network error during validation" };
  }
}

/**
 * Validate a Claude Code OAuth token
 * @param {string} token - The OAuth token to validate
 * @returns {Object} - { valid: boolean, error?: string }
 */
async function validateClaudeCodeToken(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "Token is required" };
  }

  try {
    // Claude Code OAuth tokens work with the same API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (response.ok) {
      return { valid: true, type: "oauth_token" };
    }

    if (response.status === 401) {
      return { valid: false, error: "Invalid or expired token" };
    }

    if (response.status === 429) {
      return { valid: true, type: "oauth_token", warning: "Rate limited" };
    }

    return { valid: false, error: `Validation failed with status ${response.status}` };
  } catch (error) {
    console.error("Error validating Claude Code token:", error);
    return { valid: false, error: "Network error during validation" };
  }
}

/**
 * Store an encrypted API key for an installation
 * @param {number} installationId - GitHub installation ID
 * @param {string} userId - User UUID from database
 * @param {string} apiKey - Plain text API key
 * @returns {Object} - { success: boolean, error?: string }
 */
async function storeApiKey(installationId, userId, apiKey) {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY must be set in environment");
  }

  try {
    // Encrypt the API key
    const { encrypted, iv, authTag } = encrypt(apiKey, encryptionKey);

    // Store prefix for identification (e.g., "sk-ant-api03-...")
    const keyPrefix = apiKey.substring(0, 15) + "...";

    // Save to database
    await saveApiKey(installationId, userId, encrypted, iv, authTag, keyPrefix);

    return { success: true };
  } catch (error) {
    console.error("Error storing API key:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieve and decrypt an API key for an installation
 * @param {number} installationId - GitHub installation ID
 * @returns {Object} - { success: boolean, key?: string, error?: string }
 */
async function retrieveApiKey(installationId) {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY must be set in environment");
  }

  try {
    const keyData = await getApiKey(installationId);

    if (!keyData) {
      return { success: false, error: "NO_API_KEY", message: "No API key configured for this installation" };
    }

    if (keyData.key_status !== "active") {
      return {
        success: false,
        error: "KEY_INACTIVE",
        status: keyData.key_status,
        message: `API key is ${keyData.key_status}`,
      };
    }

    // Decrypt the key
    const decryptedKey = decrypt(
      keyData.encrypted_key,
      keyData.key_iv,
      keyData.key_auth_tag,
      encryptionKey
    );

    return { success: true, key: decryptedKey };
  } catch (error) {
    console.error("Error retrieving API key:", error);
    return { success: false, error: "DECRYPTION_FAILED", message: error.message };
  }
}

/**
 * Handle API key failure (increment counter, potentially invalidate)
 * @param {number} installationId - GitHub installation ID
 * @param {string} reason - Failure reason
 * @returns {Object} - { shouldAlert: boolean, newStatus: string }
 */
async function handleApiKeyFailure(installationId, reason) {
  try {
    const result = await incrementApiKeyFailure(installationId, reason);
    return {
      shouldAlert: result.shouldAlert,
      newStatus: result.key_status,
      failureCount: result.failure_count,
    };
  } catch (error) {
    console.error("Error handling API key failure:", error);
    return { shouldAlert: false, error: error.message };
  }
}

/**
 * Reset API key status (e.g., after user updates their key)
 * @param {number} installationId - GitHub installation ID
 */
async function resetApiKeyStatus(installationId) {
  try {
    await updateApiKeyStatus(installationId, "active");
    return { success: true };
  } catch (error) {
    console.error("Error resetting API key status:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if installation has a valid API key configured
 * @param {number} installationId - GitHub installation ID
 * @returns {Object} - { hasKey: boolean, status?: string }
 */
async function checkApiKeyStatus(installationId) {
  try {
    const keyData = await getApiKey(installationId);

    if (!keyData) {
      return { hasKey: false };
    }

    return {
      hasKey: true,
      status: keyData.key_status,
      prefix: keyData.key_prefix,
      lastValidated: keyData.last_validated_at,
    };
  } catch (error) {
    console.error("Error checking API key status:", error);
    return { hasKey: false, error: error.message };
  }
}

/**
 * Get setup URL for an installation
 * @param {number} installationId - GitHub installation ID
 * @returns {string} - Setup URL
 */
function getSetupUrl(installationId) {
  const baseUrl = process.env.SETUP_URL || "https://claude-bot-setup.vercel.app";
  return `${baseUrl}/setup?installation_id=${installationId}`;
}

module.exports = {
  validateAnthropicKey,
  validateClaudeCodeToken,
  storeApiKey,
  retrieveApiKey,
  handleApiKeyFailure,
  resetApiKeyStatus,
  checkApiKeyStatus,
  getSetupUrl,
};
