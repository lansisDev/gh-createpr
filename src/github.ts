import { execSync } from "child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";

// Use native fetch (available in Node.js 18+)
// @ts-ignore
const fetch = globalThis.fetch;

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  labels: {
    nodes: Array<{ name: string }>;
  };
  assignees: {
    nodes: Array<{ login: string }>;
  };
}

interface GraphQLErrors {
  errors?: Array<{ message: string }>;
}

export const getCurrentGitRepo = () => {
  try {
    const currentRemote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    const remoteRegex = /github\.com[:/]([^/]+)\/([^/.]+)/;
    const remoteMatch = currentRemote.match(remoteRegex);

    if (!remoteMatch) {
      throw new Error("Could not determine the current repository from the git remote");
    }

    const owner = remoteMatch[1] as string;
    let repo = remoteMatch[2] as string;
    
    // Strip out .git from repo name if it exists
    repo = repo.replace(/\.git$/, '');
    
    return { owner, repo };
  } catch (e) {
    throw new Error("Error getting current repo. Make sure you are in a git repository with an origin remote on github.com.");
  }
};

export const fetchOpenIssues = async (): Promise<Array<{number: number, title: string}>> => {
  const { owner, repo } = getCurrentGitRepo();
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

  if (!GITHUB_TOKEN) {
    p.cancel(pc.red("Missing GITHUB_TOKEN environment variable"));
    process.exit(1);
  }

  const query = `
    query GetOpenIssues($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        issues(states: OPEN, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            number
            title
          }
        }
      }
    }
  `;

  const res = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { owner, repo },
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);
  }

  const response = (await res.json()) as any;

  if (response.errors && response.errors.length > 0) {
    throw new Error(`GraphQL Error: ${response.errors.map((e: any) => e.message).join(", ")}`);
  }

  const issues = response.data?.repository?.issues?.nodes || [];
  return issues;
};

export const createPrFromGithubIssue = async (issueArg: string, options?: { isInteractiveCLI?: boolean }) => {
  const issueRegex = /^(?:([a-zA-Z0-9-]+)\/([a-zA-Z0-9._-]+)#(\d+)|#(\d+)|(\d+))$/;
  const match = issueArg.match(issueRegex);

  let owner: string;
  let repo: string;
  let issueNumber: number;

  if (match) {
    // owner/repo#number format
    if (match[1] && match[2] && match[3]) {
      owner = match[1] as string;
      repo = match[2] as string;
      issueNumber = parseInt(match[3] as string, 10);
    } else if (match[4] || match[5]) {
      // #number or just number format - use current repo from git
      try {
        const current = getCurrentGitRepo();
        owner = current.owner;
        repo = current.repo;
        const numStr = match[4] || match[5];
        issueNumber = parseInt(numStr as string, 10);
      } catch (e: any) {
        if (options?.isInteractiveCLI) {
          p.log.error(e.message);
          return "back";
        }
        p.cancel(pc.red(e.message));
        process.exit(1);
      }
    } else {
      if (options?.isInteractiveCLI) {
        p.log.error("Invalid issue format. Use owner/repo#number or #number or just the number.");
        return "back";
      }
      p.cancel(pc.red("Invalid issue format. Use owner/repo#number or #number or just the number."));
      process.exit(1);
    }
  } else {
    if (options?.isInteractiveCLI) {
      p.log.error("Invalid issue format. Use owner/repo#number or #number or just the number.");
      return "back";
    }
    p.cancel(pc.red("Invalid issue format. Use owner/repo#number or #number or just the number."));
    process.exit(1);
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

  if (!GITHUB_TOKEN) {
    p.cancel(pc.red("Missing GITHUB_TOKEN environment variable"));
    process.exit(1);
  }

  const s = p.spinner();
  s.start(`Searching for issue #${issueNumber} in ${owner}/${repo}...`);

  try {
    const query = `
      query GetIssue($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            number
            title
            body
            labels(first: 10) {
              nodes {
                name
              }
            }
            assignees(first: 5) {
              nodes {
                login
              }
            }
          }
        }
      }
    `;

    const res = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { owner, repo, number: issueNumber },
      }),
    });

    if (!res.ok) {
      throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);
    }

    const response = (await res.json()) as any;

    if (response.errors && response.errors.length > 0) {
      throw new Error(`GraphQL Error: ${response.errors.map((e: any) => e.message).join(", ")}`);
    }

    const issue = response.data?.repository?.issue;

    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found in ${owner}/${repo}`);
    }

    const title: string = issue.title || "";
    const description: string = issue.body || "";
    const label = issue.labels?.nodes?.[0]?.name;

    if (!title) {
      throw new Error(`Could not get title for issue #${issueNumber}`);
    }

    s.stop(`Issue data successfully fetched`);

    // Create slug for branch
    const slugTitle = title
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const ticketRef = `${repo}-${issueNumber}`;
    const branchName = `${ticketRef}-${slugTitle}`.substring(0, 100);

    let summaryText = `${pc.bold("Issue:")} #${issueNumber}\n` +
                      `${pc.bold("Title:")} ${title}\n`;
    if (label) summaryText += `${pc.bold("Label:")} ${label}\n`;
    summaryText += `${pc.bold("Branch:")} ${pc.cyan(branchName)}`;

    p.note(summaryText, "PR Summary");

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
    
    // Validate: Check for unpushed commits on current branch
    const currentBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
    if (currentBranch) {
      // Allow it to fail gracefully if there is no upstream
      try {
        const unpushedOutput = execSync(`git log @{u}..HEAD --oneline`, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }).toString().trim();
        if (unpushedOutput) {
          throw new Error(`You have unpushed commits on branch '${currentBranch}'.\nPlease push before running this script.`);
        }
      } catch (e) {
        // No upstream branch, ignore
      }
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
    execSync(`git commit -m "feat(${ticketRef}): initial commit for ${title}" --allow-empty --no-verify`, { stdio: "ignore" });
    s.stop('Initial commit created');

    s.start('Pushing branch to remote...');
    execSync(`git push origin ${branchName}`, { stdio: "ignore" });
    s.stop('Branch pushed');

    s.start('Creating Pull Request on GitHub...');
    const prTitle = label
      ? `[${ticketRef}][${label}] ${title}`
      : `[${ticketRef}] ${title}`;

    const issueUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
    const prBody = description
      ? `**Relates to GitHub issue [${issueNumber}](${issueUrl})**\n\n${description}`
      : `**Relates to GitHub issue [${issueNumber}](${issueUrl})**`;

    execSync(`gh pr create --title "${prTitle}" --body "${prBody}" --base develop --head "${branchName}"`, { stdio: "ignore" });
    s.stop('Pull Request created');

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