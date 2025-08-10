#!/usr/bin/env node

import fetch from "node-fetch";
import { execSync } from "child_process";
import { Command } from "commander";

const program = new Command();

program
  .name("createpr")
  .description("Crea un Pull Request en GitHub a partir de un ticket de Jira")
  .argument("<JIRA_TICKET>", "Ej: LAN-3")
  .action(async (JIRA_TICKET: string) => {
    try {
      if (!JIRA_TICKET) {
        console.error(`Uso: gh createpr JIRA_TICKET (ej: LAN-3)`);
        process.exit(1);
      }

      const JIRA_BASE_URL = process.env.JIRA_BASE_URL || "";
      const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
      const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";

      if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
        console.error("❌ Error: Faltan variables de entorno (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)");
        process.exit(1);
      }

      console.log(`🔍 Obteniendo datos de ${JIRA_TICKET} desde Jira...`);

      const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_TICKET}`, {
        headers: {
          "Authorization": "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`Error de Jira: ${res.status} ${res.statusText}`);
      }

      const response: any = await res.json();

      // Error de Jira
      if (response.errorMessages && response.errorMessages.length > 0) {
        console.error(`❌ Error de Jira: ${response.errorMessages.join(", ")}`);
        process.exit(1);
      }

      const title: string = response.fields?.summary || "";
      const description: string = response.fields?.description?.content?.[0]?.content?.[0]?.text || "";

      // Obtener team
      const teamFields = [
        response.fields?.customfield_10001?.name,
        response.fields?.customfield_10001,
        response.fields?.customfield_10037?.value,
        response.fields?.customfield_10038?.value,
        response.fields?.components?.[0]?.name,
        response.fields?.labels?.[0],
      ].filter(Boolean);

      let team = teamFields.length > 0 ? teamFields[0] : response.fields?.project?.key || "";

      // Validaciones
      console.log("🔍 Validando datos obtenidos de Jira...");
      if (!title) {
        console.error(`❌ Error: No se pudo obtener el título del ticket ${JIRA_TICKET}`);
        process.exit(1);
      }
      if (!team) {
        console.error(`❌ Error: No se pudo obtener el Team del ticket ${JIRA_TICKET}`);
        process.exit(1);
      }

      // Crear slug para la rama
      const slugTitle = title
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const ticketLower = JIRA_TICKET.toLowerCase();
      const branchName = `${ticketLower}-${slugTitle}`;

      console.log(`✅ Título: ${title}`);
      console.log(`📝 Descripción: ${description}`);
      console.log(`👥 Team: ${team}`);
      console.log(`🌿 Nueva rama: ${branchName}`);

      // Cambiar a develop y actualizar
      console.log("🔄 Cambiando a develop y actualizando...");
      execSync(`git checkout develop`, { stdio: "inherit" });
      execSync(`git pull origin develop`, { stdio: "inherit" });

      // Crear nueva rama
      console.log(`🚧 Creando nueva rama: ${branchName}`);
      execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });

      // Commit inicial
      console.log("📝 Creando commit inicial...");
      execSync(`git add .`, { stdio: "inherit" });
      execSync(`git commit -m "feat(${JIRA_TICKET}): initial commit for ${title}" --allow-empty`, { stdio: "inherit" });

      console.log("⬆️  Subiendo rama a origin...");
      execSync(`git push origin ${branchName}`, { stdio: "inherit" });

      // Crear PR
      console.log(`🚀 Creando Pull Request desde ${branchName} hacia develop...`);
      const prTitle = team ? `[${JIRA_TICKET}][${team}] ${title}` : `[${JIRA_TICKET}] ${title}`;
      const prBody = `**Relates to Jira ticket [${JIRA_TICKET}](${JIRA_BASE_URL}/browse/${JIRA_TICKET})**\n\n${description}`;

      execSync(`gh pr create --title "${prTitle}" --body "${prBody}" --base develop --head "${branchName}"`, { stdio: "inherit" });

      console.log(`🎉 Pull Request creada desde '${branchName}' hacia 'develop'`);
      console.log(`✅ Ahora estás en la rama '${branchName}' con commit inicial subido`);
      console.log(`🔗 La PR está lista en GitHub`);

      execSync(`git push --set-upstream origin "${branchName}"`, { stdio: "inherit" });

    } catch (err: any) {
      console.error("❌ Error:", err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);