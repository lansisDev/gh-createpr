import { execSync } from "child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "path";
import fs from "fs";

// Use native fetch (available in Node.js 18+)
// @ts-ignore
const fetch = globalThis.fetch;

export const getJiraProjectKey = (): string => {
  // 1. Check process.env
  if (process.env.JIRA_PROJECT) return process.env.JIRA_PROJECT.toUpperCase();

  // 2. Check local .env file in the current working directory
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/^JIRA_PROJECT=(.*)$/m);
      if (match && match[1]) {
        return match[1].trim().replace(/['"]/g, '').toUpperCase();
      }
    }
  } catch (e) {
    // Ignore fs errors
  }

  // 3. Fallback: Guess from the directory name
  // e.g., "speedbike-api" -> "SPEEDBIKE", "lan-frontend" -> "LAN"
  const dirName = path.basename(process.cwd());
  const prefixMatch = dirName.match(/^([a-zA-Z]+)/);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].toUpperCase();
  }

  throw new Error("Could not determine Jira project. Please add JIRA_PROJECT=XXX to your .env file.");
};

export const fetchOpenJiraTickets = async (): Promise<Array<{key: string, summary: string, status: string}>> => {
  const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
  const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error("Missing environment variables (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)");
  }

  // Ensure no trailing slash
  const baseUrl = JIRA_BASE_URL.replace(/\/$/, "");
  const projectKey = getJiraProjectKey();

  // Fetch all open tickets for the inferred project
  const jql = `project = ${projectKey} AND resolution = Unresolved ORDER BY updated DESC`;
  
  // Atlassian deprecated /rest/api/3/search and replaced it with /rest/api/3/search/jql
  const url = `${baseUrl}/rest/api/3/search/jql`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "gh-createpr/1.3.6"
    },
    body: JSON.stringify({
      jql,
      maxResults: 30,
      fields: ["summary", "status"]
    })
  });

  if (!res.ok) {
    let errorBody = "";
    try {
      const errorJson = await res.json() as any;
      errorBody = errorJson.errorMessages ? errorJson.errorMessages.join(", ") : JSON.stringify(errorJson);
    } catch (e) {
      errorBody = await res.text();
    }
    
    if (res.status === 400 && errorBody.includes("does not exist for the field")) {
      throw new Error(`Project '${projectKey}' not found in Jira. Please define JIRA_PROJECT in your .env file.`);
    }

    throw new Error(`Jira API Error: ${res.status} ${res.statusText} on ${url}. Details: ${errorBody}`);
  }

  const response: any = await res.json();
  
  if (response.errorMessages && response.errorMessages.length > 0) {
    throw new Error(`Jira Error: ${response.errorMessages.join(", ")}`);
  }

  const issues = response.issues || [];
  return issues.map((issue: any) => ({
    key: issue.key,
    summary: issue.fields?.summary || "",
    status: issue.fields?.status?.name || "To Do"
  }));
};

export const createPrFromJira = async (jiraTicket: string, options?: { isInteractiveCLI?: boolean }) => {
  const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
  const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    p.cancel(pc.red("Missing environment variables (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)"));
    process.exit(1);
  }

  const baseUrl = JIRA_BASE_URL.replace(/\/$/, "");

  const s = p.spinner();
  s.start(`Searching for ticket ${pc.cyan(jiraTicket)} data in Jira...`);

  try {
    const res = await fetch(`${baseUrl}/rest/api/3/issue/${jiraTicket}`, {
      headers: {
        "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
        "Accept": "application/json",
        "User-Agent": "gh-createpr/1.3.6"
      }
    });

    if (!res.ok) {
      throw new Error(`Jira Error: ${res.status} ${res.statusText} on ${baseUrl}/rest/api/3/issue/${jiraTicket}`);
    }

    const response: any = await res.json();

    if (response.errorMessages && response.errorMessages.length > 0) {
      throw new Error(`Jira Error: ${response.errorMessages.join(", ")}`);
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

    if (!title) {
      throw new Error(`Could not get title for ticket ${jiraTicket}`);
    }
    if (!team) {
      throw new Error(`Could not get team for ticket ${jiraTicket}`);
    }

    s.stop(`Jira data successfully fetched`);

    // Create slug for branch
    const slugTitle = title
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const ticketLower = jiraTicket.toLowerCase();
    const branchName = `${ticketLower}-${slugTitle}`;

    p.note(
      `${pc.bold("Ticket:")} ${jiraTicket}\n` +
      `${pc.bold("Title:")} ${title}\n` +
      `${pc.bold("Team:")} ${team}\n` +
      `${pc.bold("Branch:")} ${pc.cyan(branchName)}`,
      "PR Summary"
    );

    const shouldContinue = await p.confirm({
      message: 'Continue with branch and PR creation?',
      initialValue: true,
    });

    if (p.isCancel(shouldContinue) || !shouldContinue) {
      if (options?.isInteractiveCLI) {
        p.log.step('Going back...');
        return "back";
      }
      p.cancel('Operation cancelled by user.');
      process.exit(0);
    }

    s.start('Validating git status...');
    // Validate: Check for uncommitted changes
    const statusOutput = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
    if (statusOutput) {
      throw new Error("You have uncommitted changes. Please commit or stash them before running this.");
    }
    s.stop('Git status validated');

    s.start('Switching to develop and updating...');
    execSync(`git checkout develop`, { stdio: "ignore" });
    execSync(`git pull origin develop`, { stdio: "ignore" });
    s.stop('Develop branch updated');

    s.start(`Creating new branch: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { stdio: "ignore" });
    s.stop(`Branch ${pc.cyan(branchName)} created`);

    s.start('Creating initial commit...');
    execSync(`git add .`, { stdio: "ignore" });
    execSync(`git commit -m "feat(${jiraTicket}): initial commit for ${title}" --allow-empty --no-verify`, { stdio: "ignore" });
    s.stop('Initial commit created');

    s.start('Pushing branch to remote...');
    execSync(`git push origin ${branchName}`, { stdio: "ignore" });
    s.stop('Branch pushed');

    s.start('Creating Pull Request on GitHub...');
    const prTitle = team ? `[${jiraTicket}][${team}] ${title}` : `[${jiraTicket}] ${title}`;
    const prBody = `**Relates to Jira ticket [${jiraTicket}](${baseUrl}/browse/${jiraTicket})**\n\n${description}`;
    execSync(`gh pr create --title "${prTitle}" --body "${prBody}" --base develop --head "${branchName}"`, { stdio: "ignore" });
    s.stop('Pull Request created');

    // JIRA TRANSITION TO IN PROGRESS
    s.start(`Moving ticket ${jiraTicket} to 'In Progress'...`);
    try {
      const transitionsRes = await fetch(`${baseUrl}/rest/api/3/issue/${jiraTicket}/transitions`, {
        method: "GET",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
          "Accept": "application/json"
        }
      });
      if (transitionsRes.ok) {
        const transitionsData: any = await transitionsRes.json();
        const transitions = transitionsData.transitions || [];
        const inProgress = transitions.find((t: any) => t.name.toLowerCase() === "in progress");
        
        if (inProgress) {
          const doTransitionRes = await fetch(`${baseUrl}/rest/api/3/issue/${jiraTicket}/transitions`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ transition: { id: inProgress.id } })
          });
          if (!doTransitionRes.ok) {
            p.log.warn(`Could not move to In Progress: ${doTransitionRes.statusText}`);
          } else {
            p.log.success(`Ticket ${jiraTicket} moved to 'In Progress' in Jira`);
          }
        } else {
          p.log.warn("State 'In Progress' not found for this ticket.");
        }
      }
    } catch (jiraTransitionError: any) {
      p.log.warn(`Error attempting to move in Jira: ${jiraTransitionError.message}`);
    }
    s.stop('Jira transition processed');

    execSync(`git push --set-upstream origin "${branchName}"`, { stdio: "ignore" });
    p.outro(`All done! You are on branch ${pc.cyan(branchName)} and the PR has been created.`);
    return "success";

  } catch (err: any) {
    s.stop('An error occurred');
    if (options?.isInteractiveCLI) {
      p.log.error(`Error: ${err.message}`);
      return "back";
    }
    p.cancel(pc.red(`Error: ${err.message}`));
    process.exit(1);
  }
};