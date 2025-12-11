/**
 * Trigger Claude Code Fix from Supabase
 *
 * This script can be used to trigger a fix workflow from:
 * - Supabase Edge Function
 * - Database trigger
 * - Manual script
 * - Any external source
 *
 * Usage:
 * 1. Update the constants below with your values
 * 2. Run: deno run --allow-net trigger-fix-from-supabase.ts
 * 3. Or deploy as Supabase Edge Function
 */

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

const CONFIG = {
  // Your app URL (where the Next.js app is deployed)
  APP_URL: "http://localhost:3000", // Change to https://your-app.vercel.app in production

  // Installation details (from your Supabase installations table)
  INSTALLATION_ID: 99147876,
  USER_ID: "26e33a9c-1c39-4dca-b0fc-3862cea6ae91",
  ACCOUNT_LOGIN: "Murali1889",

  // Repository details (HARDCODED FOR NOW)
  // TODO: Get this from Supabase or pass as parameter
  REPOSITORY_ID: 1109125818, // Murali1889/react-guide
  REPOSITORY_FULL_NAME: "Murali1889/react-guide",

  // Problem to fix
  PROBLEM_STATEMENT: "Add error handling to the API endpoints",

  // User ID (from Supabase users table)
  USER_ID: "26e33a9c-1c39-4dca-b0fc-3862cea6ae91",

  // API authentication - required for programmatic access
  API_SECRET: "sk-claude-bot-api-2025-12-12-secret-key-do-not-share",
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function triggerFix() {
  console.log("🚀 Triggering Claude Code fix workflow...");
  console.log(`📦 Repository: ${CONFIG.REPOSITORY_FULL_NAME}`);
  console.log(`💡 Problem: ${CONFIG.PROBLEM_STATEMENT}`);
  console.log("");

  const requestBody = {
    user_id: CONFIG.USER_ID,
    installation_id: CONFIG.INSTALLATION_ID,
    repository_id: CONFIG.REPOSITORY_ID,
    repository_full_name: CONFIG.REPOSITORY_FULL_NAME,
    problem_statement: CONFIG.PROBLEM_STATEMENT,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add API key header if provided
  if (CONFIG.API_SECRET) {
    headers["x-api-key"] = CONFIG.API_SECRET;
  }

  try {
    const response = await fetch(`${CONFIG.APP_URL}/api/fix/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Error:", data);
      throw new Error(`API returned ${response.status}: ${data.error}`);
    }

    console.log("✅ Success! Job created:");
    console.log(`   Job ID: ${data.job.id}`);
    console.log(`   Status: ${data.job.status}`);
    console.log(`   Created: ${data.job.created_at}`);
    console.log("");
    console.log("🔄 Workflow is now running in GitHub Actions...");
    console.log(`   Monitor status at: ${CONFIG.APP_URL}/fix`);

    return data.job;
  } catch (error) {
    console.error("❌ Failed to trigger workflow:");
    console.error(error);
    throw error;
  }
}

// ============================================================================
// SUPABASE EDGE FUNCTION WRAPPER
// ============================================================================

/**
 * Use this function if deploying as a Supabase Edge Function
 *
 * Deploy:
 * supabase functions deploy trigger-fix
 *
 * Call:
 * supabase functions invoke trigger-fix --data '{"repository":"Murali1889/react-guide","problem":"Fix bug"}'
 */
export async function handleSupabaseRequest(req: Request) {
  try {
    const { repository, problem, repository_id } = await req.json();

    // Override config with request data
    if (repository) {
      CONFIG.REPOSITORY_FULL_NAME = repository;
    }
    if (problem) {
      CONFIG.PROBLEM_STATEMENT = problem;
    }
    if (repository_id) {
      CONFIG.REPOSITORY_ID = repository_id;
    }

    const job = await triggerFix();

    return new Response(JSON.stringify({ success: true, job }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ============================================================================
// POSTGRES FUNCTION HELPER
// ============================================================================

/**
 * SQL to call this from Postgres trigger:
 *
 * CREATE OR REPLACE FUNCTION trigger_fix_workflow()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   PERFORM
 *     net.http_post(
 *       url := 'http://localhost:3000/api/fix/execute',
 *       headers := '{"Content-Type": "application/json"}'::jsonb,
 *       body := jsonb_build_object(
 *         'installation_id', NEW.installation_id,
 *         'repository_id', 123456789,
 *         'repository_full_name', 'Murali1889/react-guide',
 *         'problem_statement', NEW.problem_statement
 *       )
 *     );
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER on_fix_job_created
 *   AFTER INSERT ON fix_jobs
 *   FOR EACH ROW
 *   EXECUTE FUNCTION trigger_fix_workflow();
 */

// ============================================================================
// RUN DIRECTLY
// ============================================================================

// If running this file directly (not as a module)
if (import.meta.main) {
  triggerFix()
    .then(() => {
      console.log("");
      console.log("✨ Done!");
      Deno.exit(0);
    })
    .catch((error) => {
      console.error("");
      console.error("💥 Fatal error:", error);
      Deno.exit(1);
    });
}
