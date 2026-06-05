import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LeadStatus } from "@crm/database";
import {
  buildCountAllLeadsReply,
  buildCountLeadsByStatusReply,
  buildListLeadsByStatusReply,
  inferStatusFilterFromMessage,
  OPEN_LEAD_STATUSES,
  resolveLeadStatusQueryFilter
} from "../services/lead-status-query.service.js";

describe("COUNT vs LIST — resolución de filtro", () => {
  it("NEW desde interpretación", () => {
    const filter = resolveLeadStatusQueryFilter({ status: "NEW" });
    assert.deepEqual(filter.statuses, [LeadStatus.NEW]);
    assert.equal(filter.listTitle, "Leads en nuevo");
  });

  it("OPEN incluye pipeline activo sin cerrados", () => {
    const filter = resolveLeadStatusQueryFilter({ statusScope: "OPEN" });
    assert.deepEqual(filter.statuses, OPEN_LEAD_STATUSES);
    assert.equal(filter.isOpen, true);
    assert.ok(!filter.statuses.includes(LeadStatus.CLOSED_SUCCESS));
    assert.ok(!filter.statuses.includes(LeadStatus.CLOSED_LOST));
  });

  it("fallback desde mensaje: estado nuevo → LIST/COUNT", () => {
    const filter = inferStatusFilterFromMessage("¿Qué leads tengo en estado nuevo?");
    assert.equal(filter.statuses[0], LeadStatus.NEW);
  });

  it("fallback desde mensaje: abiertos", () => {
    const filter = inferStatusFilterFromMessage("¿Qué leads hay abiertos?");
    assert.equal(filter.isOpen, true);
  });

  it("fallback desde mensaje: seguimiento", () => {
    const filter = inferStatusFilterFromMessage("¿Cuántos leads tengo en seguimiento?");
    assert.equal(filter.statuses[0], LeadStatus.FOLLOW_UP);
  });
});

describe("COUNT_LEADS_BY_STATUS — respuestas", () => {
  it("conteo por estado específico", () => {
    const filter = resolveLeadStatusQueryFilter({ status: "FOLLOW_UP" });
    assert.equal(buildCountLeadsByStatusReply(2, filter), "Tienes 2 leads en seguimiento.");
    assert.equal(buildCountLeadsByStatusReply(1, filter), "Tienes 1 lead en seguimiento.");
    assert.equal(buildCountLeadsByStatusReply(0, filter), "No tienes leads en seguimiento.");
  });

  it("conteo abiertos", () => {
    const filter = resolveLeadStatusQueryFilter({ statusScope: "OPEN" });
    assert.equal(buildCountLeadsByStatusReply(2, filter), "Tienes 2 leads abiertos.");
  });

  it("conteo total general con desglose", () => {
    const reply = buildCountAllLeadsReply({
      total: 6,
      summary: [
        { statusLabel: "Nuevo", count: 2 },
        { statusLabel: "Seguimiento", count: 1 }
      ]
    });
    assert.match(reply, /6 leads en total/);
    assert.match(reply, /Nuevo: 2/);
  });
});

describe("LIST_LEADS_BY_STATUS — respuestas", () => {
  it("lista por estado", () => {
    const filter = resolveLeadStatusQueryFilter({ status: "FOLLOW_UP" });
    const reply = buildListLeadsByStatusReply({
      filter,
      count: 2,
      leads: [
        { leadNumber: 4, fullName: "Marielos Castro" },
        { leadNumber: 6, fullName: "Marielos Perez" }
      ]
    });
    assert.match(reply, /Leads en seguimiento:/);
    assert.match(reply, /#4 Marielos Castro/);
    assert.match(reply, /#6 Marielos Perez/);
    assert.match(reply, /Total: 2/);
  });

  it("lista abiertos", () => {
    const filter = resolveLeadStatusQueryFilter({ statusScope: "OPEN" });
    const reply = buildListLeadsByStatusReply({
      filter,
      count: 2,
      leads: [
        { leadNumber: 4, fullName: "Marielos Castro" },
        { leadNumber: 6, fullName: "Marielos Perez" }
      ]
    });
    assert.match(reply, /Leads abiertos:/);
    assert.match(reply, /Total abiertos: 2/);
  });

  it("lista vacía", () => {
    const filter = resolveLeadStatusQueryFilter({ status: "NEW" });
    const reply = buildListLeadsByStatusReply({ filter, count: 0, leads: [] });
    assert.match(reply, /no hay leads en nuevo/i);
  });
});

describe("COUNT vs LIST — intención", () => {
  it('"qué leads en nuevo" ≠ respuesta de total general', () => {
    const filter = inferStatusFilterFromMessage("¿Qué leads tengo en estado nuevo?");
    const listReply = buildListLeadsByStatusReply({
      filter,
      count: 1,
      leads: [{ leadNumber: 1, fullName: "Luis Vargas" }]
    });
    assert.doesNotMatch(listReply, /leads en total/i);
    assert.match(listReply, /Luis Vargas/);
  });

  it('"cuántos en seguimiento" → conteo focalizado', () => {
    const filter = inferStatusFilterFromMessage("¿Cuántos leads tengo en seguimiento?");
    const reply = buildCountLeadsByStatusReply(2, filter);
    assert.equal(reply, "Tienes 2 leads en seguimiento.");
    assert.doesNotMatch(reply, /en total/i);
  });
});
