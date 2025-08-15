#!/usr/bin/env node

const { execSync } = require("child_process");
const { Command } = require("commander");

// Use native fetch (available in Node.js 18+)
// @ts-ignore
const fetch = globalThis.fetch;

const program = new Command();

program
  .name("createpr")
  .description("Create a GitHub Pull Request from a Jira ticket")
  .argument("<JIRA_TICKET>", "Example: LAN-3")
  .action(async (JIRA_TICKET: string) => {
    try {
      if (!JIRA_TICKET) {
        console.error(`Usage: gh createpr JIRA_TICKET (example: LAN-3)`);
        process.exit(1);
      }

      const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
      const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
      const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

      if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
        console.error("❌ Error: Missing environment variables (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)");
        process.exit(1);
      }

      console.log(`🔍 Fetching data for ${JIRA_TICKET} from Jira...`);

      const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_TICKET}`, {
        headers: {
          "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`Jira error: ${res.status} ${res.statusText}`);
      }

      const response: any = await res.json();

      // Jira error
      if (response.errorMessages && response.errorMessages.length > 0) {
        console.error(`❌ Jira error: ${response.errorMessages.join(", ")}`);
        process.exit(1);
      }

      const title: string = response.fields?.summary || "";
      const description: string = response.fields?.description?.content?.[0]?.content?.[0]?.text || "";

      // Get team
      const teamFields = [
        response.fields?.customfield_10001?.name,
        response.fields?.customfield_10001,
        response.fields?.customfield_10037?.value,
        response.fields?.customfield_10038?.value,
        response.fields?.components?.[0]?.name,
        response.fields?.labels?.[0],
      ].filter(Boolean);

      let team = teamFields.length > 0 ? teamFields[0] : response.fields?.project?.key || "";

      // Validations
      console.log("🔍 Validating data obtained from Jira...");
      if (!title) {
        console.error(`❌ Error: Could not get title for ticket ${JIRA_TICKET}`);
        process.exit(1);
      }
      if (!team) {
        console.error(`❌ Error: Could not get team for ticket ${JIRA_TICKET}`);
        process.exit(1);
      }

      // Create slug for branch
      const slugTitle = title
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const ticketLower = JIRA_TICKET.toLowerCase();
      const branchName = `${ticketLower}-${slugTitle}`;

      console.log(`✅ Title: ${title}`);
      console.log(`📝 Description: ${description}`);
      console.log(`👥 Team: ${team}`);
      console.log(`🌿 New branch: ${branchName}`);

      // Switch to develop and update
      console.log("🔄 Switching to develop and updating...");
      execSync(`git checkout develop`, { stdio: "inherit" });
      execSync(`git pull origin develop`, { stdio: "inherit" });

      // Create new branch
      console.log(`🚧 Creating new branch: ${branchName}`);
      execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });

      // Initial commit
      console.log("📝 Creating initial commit...");
      execSync(`git add .`, { stdio: "inherit" });
      execSync(`git commit -m "feat(${JIRA_TICKET}): initial commit for ${title}" --allow-empty --no-verify`, { stdio: "inherit" });

      console.log("⬆️  Pushing branch to origin...");
      execSync(`git push origin ${branchName}`, { stdio: "inherit" });


      // Create PR
      console.log(`🚀 Creating Pull Request from ${branchName} to develop...`);
      const prTitle = team ? `[${JIRA_TICKET}][${team}] ${title}` : `[${JIRA_TICKET}] ${title}`;
      const prBody = `**Relates to Jira ticket [${JIRA_TICKET}](${JIRA_BASE_URL}/browse/${JIRA_TICKET})**\n\n${description}`;

      execSync(`gh pr create --title "${prTitle}" --body "${prBody}" --base develop --head "${branchName}"`, { stdio: "inherit" });

      // --- JIRA TRANSITION TO IN PROGRESS ---
      try {
        console.log(`🔄 Attempting to move Jira ticket ${JIRA_TICKET} to 'In Progress'...`);
        // 1. Get available transitions
        const transitionsRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_TICKET}/transitions`, {
          method: "GET",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
            "Accept": "application/json"
          }
        });
        if (!transitionsRes.ok) throw new Error(`Failed to fetch Jira transitions: ${transitionsRes.status} ${transitionsRes.statusText}`);
  const transitionsData: any = await transitionsRes.json();
  const transitions = transitionsData.transitions || [];
        // 2. Find the transition for 'In Progress' (case-insensitive)
        const inProgress = transitions.find((t: any) => t.name.toLowerCase() === "in progress");
        if (!inProgress) {
          console.warn("⚠️  Could not find 'In Progress' transition for this Jira ticket. No status change made.");
        } else {
          // 3. Perform the transition
          const transitionId = inProgress.id;
          const doTransitionRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_TICKET}/transitions`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ transition: { id: transitionId } })
          });
          if (!doTransitionRes.ok) {
            throw new Error(`Failed to transition Jira ticket: ${doTransitionRes.status} ${doTransitionRes.statusText}`);
          }
          console.log(`✅ Jira ticket ${JIRA_TICKET} moved to 'In Progress'.`);
        }
      } catch (jiraTransitionError: any) {
        console.warn(`⚠️  Could not transition Jira ticket to 'In Progress': ${jiraTransitionError.message}`);
      }

      console.log(`🎉 Pull Request created from '${branchName}' to 'develop'`);
      console.log(`✅ You are now on branch '${branchName}' with initial commit pushed`);
      console.log(`🔗 The PR is ready on GitHub`);

      execSync(`git push --set-upstream origin "${branchName}"`, { stdio: "inherit" });

    } catch (err: any) {
      console.error("❌ Error:", err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);