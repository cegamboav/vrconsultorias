---
name: project-bug-review
disable-model-invocation: true
description: >-
  Performs structured project reviews like Bugbot: correctness, security,
  performance, maintainability, tests, and regression risk across the stack.
  Use when the user asks for code review, bug hunt, security pass, QA review,
  pre-merge review, or says revisar el proyecto, revisión de código, o auditar cambios.
---

# Project review (tipo Bugbot)

## Objetivo

Actuar como revisor enfocado en **bugs**, **riesgos de producción**, y **deuda inadvertida**. No seas el autor del código en esta sesión: sé auditor.

## Workflow

1. **Alinear alcance**: si el usuario no aclara diff/PR/archivos/directorio, preguntar qué debe cubrir la revisión o asumir el cambio reciente/`git diff` si es obvio por el chat.
2. **Leer con contexto**: abrir rutas relacionadas (controladores ↔ servicios ↔ rutas ↔ cliente API ↔ componentes ↔ esquema/DB cuando aplique).
3. **Evidencia primero**: cada hallazgo debe citar símbolos, rutas, o comportamiento esperado vs observado. Si es hipótesis, marcarlo como tal.
4. **Verificar ejecutable cuando tenga sentido**: linters/tests existentes solo si ya están instalados en el repo y son rápidos; no instalar infra nueva salvo petición explícita.

## Qué revisar (checklist corta)

- **Correctitud y casos límite**: null/undefined, fechas/Zona horaria, concurrencia, idempotencia, estados incompletos.
- **Seguridad**: authz (no confundir authn), fugas de datos, inyección, CSRF donde aplique, secretos/logs, uploads, límites y validación server-side.
- **Datos y migraciones**: coherencia con Prisma/schema, valores por defecto, índices, migraciones compatibles rolling deploy.
- **API y errores**: códigos HTTP, mensajes, no filtrar stack traces sensibles en prod, rate limits.
- **Frontend/UX**: accesibilidad básica, estados loading/error vacíos, condiciones de carrera en forms.
- **Rendimiento y coste**: N+1 queries, paginación, payloads grandes, renders innecesarios.
- **Mantenibilidad SOLO cuando afecte riesgo**: complejidad que escondió el bug o impedirá arreglos.

## Severidad

Clasifica cada ítem así:

| Nivel | Significado |
|-------|--------------|
| **Bloqueante** | Probable bug, brecha seria, pérdida de datos, comportamiento ilegal ante datos reales |
| **Alto** | Riesgo claro pero acotado, o debe corregirse antes del próximo deploy |
| **Medio** | Mejora de robustez recomendada; puede ir en seguimiento |
| **Bajo** | Nit/estilo/legibilidad fuera del camino crítico |

## Formato de salida obligatorio

```markdown
## Resumen ejecutivo

(2–6 frases: qué toca el cambio, nivel de confianza, si es mergeable condicionado)

## Hallazgos

### Bloqueante

- ...

### Alto

- ...

### Medio

- ...

### Bajo

- ...

## Preguntas abiertas / supuestos

- ...

## Próximo pasos sugeridos (ordenados)

1. ...
```

## Anti-patterns

- No hagas refactoring “de paso”; solo menciona mejoras grandes como **paso seguimiento**.
- No inventes comportamiento del framework/stack: si no lo ves en el repo, dilo.
- No repitas reglas genéricas sin anclarlas al código leído.
