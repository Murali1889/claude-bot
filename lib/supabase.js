/**
 * Supabase Client Module
 * Handles database operations for user, installation, and API key management
 */

const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client with service key (server-side only)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment"
      );
    }
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

/**
 * Create or update a user record
 */
async function upsertUser(githubUserId, githubUsername, email = null, avatarUrl = null) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("users")
    .upsert(
      {
        github_user_id: githubUserId,
        github_username: githubUsername,
        email: email,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "github_user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error upserting user:", error);
    throw error;
  }

  return data;
}

/**
 * Get user by GitHub user ID
 */
async function getUserByGitHubId(githubUserId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("github_user_id", githubUserId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("Error getting user:", error);
    throw error;
  }

  return data;
}

/**
 * Create or update an installation record
 */
async function upsertInstallation(installationId, accountLogin, accountType, accountId, userId = null) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("installations")
    .upsert(
      {
        installation_id: installationId,
        account_login: accountLogin,
        account_type: accountType,
        account_id: accountId,
        user_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error upserting installation:", error);
    throw error;
  }

  return data;
}

/**
 * Get installation by installation ID
 */
async function getInstallation(installationId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("installations")
    .select(`
      *,
      users:user_id (
        id,
        github_user_id,
        github_username,
        email
      )
    `)
    .eq("installation_id", installationId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error getting installation:", error);
    throw error;
  }

  return data;
}

/**
 * Link a user to an installation
 */
async function linkUserToInstallation(installationId, userId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("installations")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("installation_id", installationId)
    .select()
    .single();

  if (error) {
    console.error("Error linking user to installation:", error);
    throw error;
  }

  return data;
}

/**
 * Delete an installation and related data
 */
async function deleteInstallation(installationId) {
  const client = getSupabaseClient();

  // Delete API key first (if exists)
  await client.from("api_keys").delete().eq("installation_id", installationId);

  // Delete installation
  const { error } = await client
    .from("installations")
    .delete()
    .eq("installation_id", installationId);

  if (error) {
    console.error("Error deleting installation:", error);
    throw error;
  }

  return true;
}

/**
 * Save encrypted API key for an installation
 */
async function saveApiKey(installationId, userId, encryptedKey, iv, authTag, keyPrefix) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("api_keys")
    .upsert(
      {
        installation_id: installationId,
        user_id: userId,
        encrypted_key: encryptedKey,
        key_iv: iv,
        key_auth_tag: authTag,
        key_prefix: keyPrefix,
        key_status: "active",
        failure_count: 0,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error saving API key:", error);
    throw error;
  }

  return data;
}

/**
 * Get API key for an installation
 */
async function getApiKey(installationId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("api_keys")
    .select("*")
    .eq("installation_id", installationId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error getting API key:", error);
    throw error;
  }

  return data;
}

/**
 * Update API key status (e.g., mark as invalid)
 */
async function updateApiKeyStatus(installationId, status, failureReason = null) {
  const client = getSupabaseClient();

  const updateData = {
    key_status: status,
    updated_at: new Date().toISOString(),
  };

  if (failureReason) {
    updateData.failure_reason = failureReason;
  }

  const { data, error } = await client
    .from("api_keys")
    .update(updateData)
    .eq("installation_id", installationId)
    .select()
    .single();

  if (error) {
    console.error("Error updating API key status:", error);
    throw error;
  }

  return data;
}

/**
 * Increment failure count for an API key
 */
async function incrementApiKeyFailure(installationId, failureReason) {
  const client = getSupabaseClient();

  // First get current failure count
  const { data: current } = await client
    .from("api_keys")
    .select("failure_count")
    .eq("installation_id", installationId)
    .single();

  const newCount = (current?.failure_count || 0) + 1;
  const newStatus = newCount >= 3 ? "invalid" : "active";

  const { data, error } = await client
    .from("api_keys")
    .update({
      failure_count: newCount,
      failure_reason: failureReason,
      key_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("installation_id", installationId)
    .select()
    .single();

  if (error) {
    console.error("Error incrementing failure count:", error);
    throw error;
  }

  return { ...data, shouldAlert: newCount >= 3 };
}

/**
 * Get or create notification settings for a user
 */
async function getNotificationSettings(userId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error getting notification settings:", error);
    throw error;
  }

  // Return defaults if no settings exist
  if (!data) {
    return {
      email_enabled: true,
      github_issue_enabled: true,
      slack_enabled: false,
      slack_webhook_url: null,
    };
  }

  return data;
}

/**
 * Update notification settings for a user
 */
async function updateNotificationSettings(userId, settings) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("notification_settings")
    .upsert(
      {
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error updating notification settings:", error);
    throw error;
  }

  return data;
}

/**
 * Get all installations for a user
 */
async function getUserInstallations(userId) {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("installations")
    .select(`
      *,
      api_keys (
        key_prefix,
        key_status,
        last_validated_at
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting user installations:", error);
    throw error;
  }

  return data || [];
}

module.exports = {
  getSupabaseClient,
  upsertUser,
  getUserByGitHubId,
  upsertInstallation,
  getInstallation,
  linkUserToInstallation,
  deleteInstallation,
  saveApiKey,
  getApiKey,
  updateApiKeyStatus,
  incrementApiKeyFailure,
  getNotificationSettings,
  updateNotificationSettings,
  getUserInstallations,
};
