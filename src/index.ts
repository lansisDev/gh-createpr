#!/usr/bin/env node

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { createPrFromJira, fetchOpenJiraTickets, getJiraProjectKey } from "./jira.js";
import { createPrFromGithubIssue, fetchOpenIssues } from "./github.js";

const program = new Command();

program
  .name("gh-createpr")
  .description("Interactive CLI to create GitHub Pull Requests from Jira or GitHub Issues")
  .version("1.3.6");

program
  .command("jira")
  .description("Create a PR from a Jira ticket")
  .argument("[ticket]", "Jira ticket ID (e.g. LAN-3)")
  .action(async (ticket: string | undefined) => {
    let finalTicket = ticket;
    
    if (!finalTicket) {
      p.intro(pc.bgBlue(pc.white(" gh-createpr: Jira ")));
      const result = await p.text({
        message: "Enter the Jira ticket ID (e.g. LAN-3):",
        placeholder: "LAN-3",
        validate(value) {
          if (!value) return "Please enter a ticket.";
        }
      });
      if (p.isCancel(result)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      finalTicket = result as string;
    }

    await createPrFromJira(finalTicket);
  });

program
  .command("github")
  .description("Create a PR from a GitHub Issue")
  .argument("[issue]", "Issue ID (e.g. owner/repo#123 or #123)")
  .action(async (issue: string | undefined) => {
    let finalIssue = issue;
    
    if (!finalIssue) {
      p.intro(pc.bgMagenta(pc.white(" gh-createpr: GitHub Issue ")));
      const result = await p.text({
        message: "Enter the Issue ID (e.g. owner/repo#123 or #123):",
        placeholder: "#123",
        validate(value) {
          if (!value) return "Please enter an identifier.";
        }
      });
      if (p.isCancel(result)) {
        p.cancel("Operation cancelled.");
        process.exit(0);
      }
      finalIssue = result as string;
    }

    await createPrFromGithubIssue(finalIssue);
  });

program.action(async () => {
  p.intro(pc.bgCyan(pc.black(" gh-createpr: Interactive CLI ")));

  let currentState = "SELECT_SOURCE";
  let sourceType = "";
  let ticketId = "";
  let githubIssueId = "";

  while (true) {
    if (currentState === "SELECT_SOURCE") {
      const selection = await p.select({
        message: "Where do you want to create your Pull Request from?",
        options: [
          { value: "jira", label: "Jira Ticket", hint: "e.g. LAN-3" },
          { value: "github", label: "GitHub Issue", hint: "e.g. #123 or owner/repo#123" },
        ],
      });

      if (p.isCancel(selection)) {
        p.cancel("Operation cancelled by user.");
        process.exit(0);
      }

      sourceType = selection as string;
      currentState = sourceType === "jira" ? "SELECT_JIRA_TICKET" : "SELECT_GITHUB_ISSUE";
    }

    if (currentState === "SELECT_JIRA_TICKET") {
      const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
      const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
      const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

      if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
        p.log.error("Missing environment variables (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)");
        currentState = "SELECT_SOURCE";
        continue;
      }

      const s = p.spinner();
      let projectKey = "Jira";
      try {
        projectKey = getJiraProjectKey();
      } catch(e) {}
      
      s.start(`Searching for open tickets in ${projectKey}...`);
      
      let openTickets: Array<{key: string, summary: string, status: string}> = [];
      try {
        openTickets = await fetchOpenJiraTickets();
        s.stop(`Found ${openTickets.length} open tickets.`);
      } catch (e: any) {
        s.stop("Could not load open tickets.");
        p.log.warn(`⚠️ Error: ${e.message}`);
        openTickets = []; // Fallback to manual entry
      }

      const options: any[] = [];
      if (openTickets.length > 0) {
        openTickets.forEach(ticket => {
          options.push({
            value: ticket.key,
            label: `[${ticket.key}] ${ticket.summary.length > 60 ? ticket.summary.substring(0, 57) + "..." : ticket.summary} ${pc.gray(`(${ticket.status})`)}`
          });
        });
      }
      
      options.push({ value: "manual", label: pc.yellow("✏️  Enter ID manually...") });
      options.push({ value: "back", label: pc.gray("⬅️  Go back") });

      const selection = await p.select({
        message: "Select the Jira ticket to work on:",
        options,
      });

      if (p.isCancel(selection) || selection === "back") {
        currentState = "SELECT_SOURCE";
        continue;
      }

      if (selection === "manual") {
        currentState = "INPUT_JIRA_MANUAL";
      } else {
        ticketId = selection as string;
        currentState = "CONFIRM_JIRA";
      }
    }

    if (currentState === "INPUT_JIRA_MANUAL") {
      const input = await p.text({
        message: "Enter the Jira ticket ID (Esc to go back):",
        placeholder: "LAN-3",
        validate: (value) => {
          if (!value) return "Please enter a valid ticket.";
        }
      });

      if (p.isCancel(input)) {
        currentState = "SELECT_JIRA_TICKET";
        continue;
      }

      ticketId = input as string;
      currentState = "CONFIRM_JIRA";
    }

    if (currentState === "CONFIRM_JIRA") {
      const result = await createPrFromJira(ticketId, { isInteractiveCLI: true });
      if (result === "back") {
        currentState = "SELECT_JIRA_TICKET";
        continue;
      }
      break; // Done
    }

    if (currentState === "SELECT_GITHUB_ISSUE") {
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
      
      if (!GITHUB_TOKEN) {
        p.log.error("Missing GITHUB_TOKEN environment variable. Set it to list issues.");
        currentState = "SELECT_SOURCE";
        continue;
      }

      const s = p.spinner();
      s.start("Searching for open issues in the repository...");
      
      let openIssues: Array<{number: number, title: string}> = [];
      try {
        openIssues = await fetchOpenIssues();
        s.stop(`Found ${openIssues.length} open issues.`);
      } catch (e: any) {
        s.stop("Could not load open issues.");
        p.log.warn(`⚠️ Error: ${e.message}`);
        openIssues = []; // Fallback to manual entry
      }

      const options: any[] = [];
      if (openIssues.length > 0) {
        openIssues.forEach(issue => {
          options.push({
            value: issue.number.toString(),
            label: `#${issue.number} - ${issue.title.length > 60 ? issue.title.substring(0, 57) + "..." : issue.title}`
          });
        });
      }
      
      options.push({ value: "manual", label: pc.yellow("✏️  Enter ID manually...") });
      options.push({ value: "back", label: pc.gray("⬅️  Go back") });

      const selection = await p.select({
        message: "Select the issue to work on:",
        options,
      });

      if (p.isCancel(selection) || selection === "back") {
        currentState = "SELECT_SOURCE";
        continue;
      }

      if (selection === "manual") {
        currentState = "INPUT_GITHUB_MANUAL";
      } else {
        githubIssueId = selection as string;
        currentState = "CONFIRM_GITHUB";
      }
    }

    if (currentState === "INPUT_GITHUB_MANUAL") {
      const input = await p.text({
        message: "Enter the Issue ID (Esc to go back):",
        placeholder: "#123",
        validate: (value) => {
          if (!value) return "Please enter a valid ID.";
        }
      });

      if (p.isCancel(input)) {
        currentState = "SELECT_GITHUB_ISSUE";
        continue;
      }

      githubIssueId = input as string;
      currentState = "CONFIRM_GITHUB";
    }

    if (currentState === "CONFIRM_GITHUB") {
      const result = await createPrFromGithubIssue(githubIssueId, { isInteractiveCLI: true });
      if (result === "back") {
        currentState = "SELECT_GITHUB_ISSUE";
        continue;
      }
      break; // Done
    }
  }
});

program.parse(process.argv);