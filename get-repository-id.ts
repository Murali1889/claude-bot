/**
 * Get Repository ID from GitHub
 *
 * Usage:
 * deno run --allow-net get-repository-id.ts
 */

const REPO_FULL_NAME = "Murali1889/react-guide"; // Change this to your repo

async function getRepositoryId() {
  console.log(`🔍 Fetching repository ID for ${REPO_FULL_NAME}...`);

  const response = await fetch(
    `https://api.github.com/repos/${REPO_FULL_NAME}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  console.log("");
  console.log("✅ Repository found!");
  console.log(`   Name: ${data.full_name}`);
  console.log(`   ID: ${data.id}`);
  console.log(`   Owner: ${data.owner.login}`);
  console.log(`   Private: ${data.private}`);
  console.log("");
  console.log(`📝 Use this in your config:`);
  console.log(`   REPOSITORY_ID: ${data.id},`);
  console.log(`   REPOSITORY_FULL_NAME: "${data.full_name}",`);

  return data.id;
}

if (import.meta.main) {
  getRepositoryId().catch(console.error);
}
