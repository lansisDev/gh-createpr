import { execSync } from "child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";

// Use native fetch (available in Node.js 18+)
// @ts-ignore
const fetch = globalThis.fetch;

export const createPrFromJira = async (jiraTicket: string) => {
  const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
  const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    p.cancel(pc.red("Faltan variables de entorno (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)"));
    process.exit(1);
  }

  const s = p.spinner();
  s.start(`Buscando datos del ticket ${pc.cyan(jiraTicket)} en Jira...`);

  try {
    const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${jiraTicket}`, {
      headers: {
        "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Error de Jira: ${res.status} ${res.statusText}`);
    }

    const response: any = await res.json();

    if (response.errorMessages && response.errorMessages.length > 0) {
      throw new Error(`Error de Jira: ${response.errorMessages.join(", ")}`);
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
      throw new Error(`No se pudo obtener el título para el ticket ${jiraTicket}`);
    }
    if (!team) {
      throw new Error(`No se pudo obtener el equipo para el ticket ${jiraTicket}`);
    }

    s.stop(`Datos de Jira obtenidos correctamente`);

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
      `${pc.bold("Título:")} ${title}\n` +
      `${pc.bold("Equipo:")} ${team}\n` +
      `${pc.bold("Rama:")} ${pc.cyan(branchName)}`,
      "Resumen del PR"
    );

    const shouldContinue = await p.confirm({
      message: '¿Continuar con la creación de la rama y PR?',
      initialValue: true,
    });

    if (p.isCancel(shouldContinue) || !shouldContinue) {
      p.cancel('Operación cancelada por el usuario.');
      process.exit(0);
    }

    s.start('Validando estado de git...');
    // Validate: Check for uncommitted changes
    const statusOutput = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
    if (statusOutput) {
      throw new Error("Tenés cambios sin commitear. Por favor hacé commit o stash antes de correr esto.");
    }
    s.stop('Estado de git validado');

    s.start('Cambiando a develop y actualizando...');
    execSync(`git checkout develop`, { stdio: "ignore" });
    execSync(`git pull origin develop`, { stdio: "ignore" });
    s.stop('Rama develop actualizada');

    s.start(`Creando nueva rama: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { stdio: "ignore" });
    s.stop(`Rama ${pc.cyan(branchName)} creada`);

    s.start('Creando commit inicial...');
    execSync(`git add .`, { stdio: "ignore" });
    execSync(`git commit -m "feat(${jiraTicket}): initial commit for ${title}" --allow-empty --no-verify`, { stdio: "ignore" });
    s.stop('Commit inicial creado');

    s.start('Pusheando rama al remoto...');
    execSync(`git push origin ${branchName}`, { stdio: "ignore" });
    s.stop('Rama pusheada');

    s.start('Creando Pull Request en GitHub...');
    const prTitle = team ? `[${jiraTicket}][${team}] ${title}` : `[${jiraTicket}] ${title}`;
    const prBody = `**Relates to Jira ticket [${jiraTicket}](${JIRA_BASE_URL}/browse/${jiraTicket})**\n\n${description}`;
    execSync(`gh pr create --title "${prTitle}" --body "${prBody}" --base develop --head "${branchName}"`, { stdio: "ignore" });
    s.stop('Pull Request creado');

    // JIRA TRANSITION TO IN PROGRESS
    s.start(`Moviendo ticket ${jiraTicket} a 'In Progress'...`);
    try {
      const transitionsRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${jiraTicket}/transitions`, {
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
          const doTransitionRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${jiraTicket}/transitions`, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ transition: { id: inProgress.id } })
          });
          if (!doTransitionRes.ok) {
            p.log.warn(`No se pudo mover a In Progress: ${doTransitionRes.statusText}`);
          } else {
            p.log.success(`Ticket ${jiraTicket} movido a 'In Progress' en Jira`);
          }
        } else {
          p.log.warn("No se encontró el estado 'In Progress' para este ticket.");
        }
      }
    } catch (jiraTransitionError: any) {
      p.log.warn(`Error al intentar mover en Jira: ${jiraTransitionError.message}`);
    }
    s.stop('Transición de Jira procesada');

    execSync(`git push --set-upstream origin "${branchName}"`, { stdio: "ignore" });
    p.outro(`¡Todo listo! Estás en la rama ${pc.cyan(branchName)} y la PR ya está subida.`);

  } catch (err: any) {
    s.stop('Ocurrió un error');
    p.cancel(pc.red(`Error: ${err.message}`));
    process.exit(1);
  }
};
