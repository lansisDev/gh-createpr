#!/usr/bin/env node

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { createPrFromJira } from "./jira.js";
import { createPrFromGithubIssue, fetchOpenIssues } from "./github.js";

const program = new Command();

program
  .name("gh-createpr")
  .description("CLI interactiva para crear GitHub Pull Requests desde Jira o GitHub Issues")
  .version("1.3.6");

program
  .command("jira")
  .description("Crear PR desde un ticket de Jira")
  .argument("[ticket]", "ID del ticket de Jira (ej: LAN-3)")
  .action(async (ticket: string | undefined) => {
    let finalTicket = ticket;
    
    if (!finalTicket) {
      p.intro(pc.bgBlue(pc.white(" gh-createpr: Jira ")));
      const result = await p.text({
        message: "Ingresá el ID del ticket de Jira (ej: LAN-3):",
        placeholder: "LAN-3",
        validate(value) {
          if (!value) return "Por favor ingresá un ticket.";
        }
      });
      if (p.isCancel(result)) {
        p.cancel("Operación cancelada.");
        process.exit(0);
      }
      finalTicket = result as string;
    }

    await createPrFromJira(finalTicket);
  });

program
  .command("github")
  .description("Crear PR desde una GitHub Issue")
  .argument("[issue]", "ID de la Issue (ej: owner/repo#123 o #123)")
  .action(async (issue: string | undefined) => {
    let finalIssue = issue;
    
    if (!finalIssue) {
      p.intro(pc.bgMagenta(pc.white(" gh-createpr: GitHub Issue ")));
      const result = await p.text({
        message: "Ingresá el ID de la Issue (ej: owner/repo#123 o #123):",
        placeholder: "#123",
        validate(value) {
          if (!value) return "Por favor ingresá un identificador.";
        }
      });
      if (p.isCancel(result)) {
        p.cancel("Operación cancelada.");
        process.exit(0);
      }
      finalIssue = result as string;
    }

    await createPrFromGithubIssue(finalIssue);
  });

program.action(async () => {
  p.intro(pc.bgCyan(pc.black(" gh-createpr: CLI Interactiva ")));

  const sourceType = await p.select({
    message: "¿Desde dónde querés crear tu Pull Request?",
    options: [
      { value: "jira", label: "Jira Ticket", hint: "Ej: LAN-3" },
      { value: "github", label: "GitHub Issue", hint: "Ej: #123 o owner/repo#123" },
    ],
  });

  if (p.isCancel(sourceType)) {
    p.cancel("Operación cancelada por el usuario.");
    process.exit(0);
  }

  if (sourceType === "jira") {
    const ticketId = await p.text({
      message: "Ingresá el ID del ticket de Jira:",
      placeholder: "LAN-3",
      validate: (value) => {
        if (!value) return "Por favor ingresá un ticket válido.";
      }
    });

    if (p.isCancel(ticketId)) {
      p.cancel("Operación cancelada.");
      process.exit(0);
    }

    await createPrFromJira(ticketId as string);
  } else if (sourceType === "github") {
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
    
    if (!GITHUB_TOKEN) {
      p.cancel(pc.red("Falta la variable de entorno GITHUB_TOKEN. Configurala para poder listar las issues."));
      process.exit(1);
    }

    const s = p.spinner();
    s.start("Buscando issues abiertas en el repositorio...");
    
    let openIssues: Array<{number: number, title: string}> = [];
    try {
      openIssues = await fetchOpenIssues();
      s.stop(`Encontradas ${openIssues.length} issues abiertas.`);
    } catch (e: any) {
      s.stop("No se pudieron cargar las issues abiertas.");
      p.log.warn(`⚠️ Error: ${e.message}`);
      openIssues = []; // Fallback to manual entry
    }

    let issueId: string | symbol = "";

    if (openIssues.length > 0) {
      const options = openIssues.map(issue => ({
        value: issue.number.toString(),
        label: `#${issue.number} - ${issue.title.length > 60 ? issue.title.substring(0, 57) + "..." : issue.title}`
      }));
      
      options.push({ value: "manual", label: pc.yellow("✏️  Ingresar ID manualmente...") });

      issueId = await p.select({
        message: "Seleccioná la issue para trabajar:",
        options,
      });

      if (p.isCancel(issueId)) {
        p.cancel("Operación cancelada.");
        process.exit(0);
      }
    } else {
      issueId = "manual";
    }

    if (issueId === "manual") {
      issueId = await p.text({
        message: "Ingresá el ID de la Issue:",
        placeholder: "#123",
        validate: (value) => {
          if (!value) return "Por favor ingresá un ID válido.";
        }
      });

      if (p.isCancel(issueId)) {
        p.cancel("Operación cancelada.");
        process.exit(0);
      }
    }

    await createPrFromGithubIssue(issueId as string);
  }
});

program.parse(process.argv);