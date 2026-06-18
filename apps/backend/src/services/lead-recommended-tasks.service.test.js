import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRecommendedTasksScope,
  buildRecommendedTasksFromContext,
  formatRecommendedTasksText,
  resolveRecommendedTasksScope,
  sortRecommendedTasks
} from "./lead-recommended-tasks.service.js";

describe("GET_RECOMMENDED_TASKS — tareas priorizadas", () => {
  it("genera contactos hoy y tareas de la semana", () => {
    const tasks = buildRecommendedTasksFromContext({
      overdueLeads: [],
      actionableLeads: [
        { leadId: "l1", leadNumber: 1, fullName: "Keylin Perez" },
        { leadId: "l2", leadNumber: 2, fullName: "Marielos Perez" }
      ],
      priorityLeads: [],
      upcomingLeads: [],
      inactiveLeads: [],
      dominantFollowUpReason: { reason: "NO_MONEY", share: 0.6 },
      openLeadsTotal: 4
    });

    assert.ok(tasks.some((t) => t.message === "Contactar a Keylin Perez."));
    assert.ok(tasks.some((t) => /limitaciones económicas/i.test(t.message)));
    assert.ok(tasks.some((t) => /Generar al menos 3 nuevos leads/i.test(t.message)));
    assert.ok(tasks.some((t) => t.type === "REVIEW_NOTES"));
  });

  it("seguimientos vencidos son CRITICAL", () => {
    const tasks = buildRecommendedTasksFromContext({
      overdueLeads: [{ leadId: "l9", leadNumber: 9, fullName: "Luis Vargas" }],
      actionableLeads: [{ leadId: "l9", leadNumber: 9, fullName: "Luis Vargas" }],
      priorityLeads: [],
      upcomingLeads: [],
      inactiveLeads: [],
      openLeadsTotal: 10
    });

    const luisTasks = tasks.filter((t) => t.leadName === "Luis Vargas");
    assert.equal(luisTasks.length, 1);
    assert.equal(luisTasks[0].level, "CRITICAL");
  });

  it("ordena CRITICAL antes que LOW", () => {
    const sorted = sortRecommendedTasks([
      { level: "LOW", horizon: "LOW_PRIORITY", message: "low" },
      { level: "CRITICAL", horizon: "TODAY", message: "crit" },
      { level: "HIGH", horizon: "TODAY", message: "high" }
    ]);
    assert.equal(sorted[0].level, "CRITICAL");
    assert.equal(sorted[0].priority, 1);
  });

  it("formato agrupa Hoy, Esta semana y Baja prioridad (scope WEEK)", () => {
    const tasks = sortRecommendedTasks([
      { level: "HIGH", horizon: "TODAY", message: "Contactar a Keylin Perez." },
      { level: "HIGH", horizon: "TODAY", message: "Contactar a Marielos Perez." },
      {
        level: "MEDIUM",
        horizon: "THIS_WEEK",
        message: "Dar seguimiento a clientes con limitaciones económicas."
      },
      { level: "MEDIUM", horizon: "THIS_WEEK", message: "Generar al menos 3 nuevos leads." },
      {
        level: "LOW",
        horizon: "LOW_PRIORITY",
        message: "Revisar notas y actualizar información de leads activos."
      }
    ]);

    const text = formatRecommendedTasksText(tasks, "WEEK");
    assert.match(text, /Plan de trabajo/);
    assert.match(text, /Hoy/);
    assert.match(text, /Esta semana/);
    assert.match(text, /Baja prioridad/);
    assert.match(text, /1\. Contactar a Keylin Perez/);
  });

  it("scope TODAY muestra solo tareas de hoy", () => {
    const allTasks = sortRecommendedTasks([
      { level: "HIGH", horizon: "TODAY", message: "Contactar a Keylin Perez." },
      { level: "HIGH", horizon: "TODAY", message: "Contactar a Marielos Perez." },
      {
        level: "MEDIUM",
        horizon: "THIS_WEEK",
        message: "Dar seguimiento a clientes con limitaciones económicas."
      },
      {
        level: "LOW",
        horizon: "LOW_PRIORITY",
        message: "Revisar notas y actualizar información de leads activos."
      }
    ]);

    const todayTasks = applyRecommendedTasksScope(allTasks, "TODAY");
    const text = formatRecommendedTasksText(todayTasks, "TODAY");

    assert.equal(todayTasks.length, 2);
    assert.equal(todayTasks[0].priority, 1);
    assert.equal(todayTasks[1].priority, 2);
    assert.match(text, /Plan para hoy/);
    assert.match(text, /1\. Contactar a Keylin Perez/);
    assert.match(text, /2\. Contactar a Marielos Perez/);
    assert.doesNotMatch(text, /Esta semana/);
    assert.doesNotMatch(text, /Baja prioridad/);
  });
});

describe("GET_RECOMMENDED_TASKS — scope temporal", () => {
  it("¿Qué debería hacer hoy exactamente? → TODAY", () => {
    assert.equal(
      resolveRecommendedTasksScope("¿Qué debería hacer hoy exactamente?"),
      "TODAY"
    );
  });

  it("¿Qué hago hoy? → TODAY", () => {
    assert.equal(resolveRecommendedTasksScope("¿Qué hago hoy?"), "TODAY");
  });

  it("Dame mi plan de trabajo → WEEK", () => {
    assert.equal(resolveRecommendedTasksScope("Dame mi plan de trabajo"), "WEEK");
  });

  it("¿Qué tareas tengo esta semana? → WEEK", () => {
    assert.equal(
      resolveRecommendedTasksScope("¿Qué tareas tengo esta semana?"),
      "WEEK"
    );
  });

  it("Organiza mis prioridades → WEEK", () => {
    assert.equal(resolveRecommendedTasksScope("Organiza mis prioridades"), "WEEK");
  });

  it("interpretation.scope tiene prioridad", () => {
    assert.equal(
      resolveRecommendedTasksScope("Dame mi plan de trabajo", { scope: "TODAY" }),
      "TODAY"
    );
  });
});

describe("GET_RECOMMENDED_TASKS — intenciones", () => {
  it("acción esperada", () => {
    assert.equal({ action: "GET_RECOMMENDED_TASKS" }.action, "GET_RECOMMENDED_TASKS");
  });
});
