# Contributing

## Commits — Conventional Commits

Este proyecto usa [Conventional Commits](https://www.conventionalcommits.org/) para mantener un historial legible y poder generar changelogs automáticamente.

### Formato

```
<type>(<scope>): <description>

[body opcional]

[footer opcional — BREAKING CHANGE: ...]
```

### Tipos

| Tipo | Cuándo usarlo | Bump |
|------|--------------|------|
| `feat` | Nueva funcionalidad | MINOR |
| `fix` | Corrección de bug | PATCH |
| `perf` | Mejora de rendimiento | PATCH |
| `refactor` | Refactor sin cambio de comportamiento | — |
| `test` | Agregar o corregir tests | — |
| `docs` | Solo documentación | — |
| `chore` | Tareas de mantenimiento, deps | — |
| `ci` | Cambios en CI/CD | — |

Agrega `!` después del tipo para indicar un **breaking change** (MAJOR bump):
```
feat(api)!: cambiar formato de respuesta de leads
```

### Scopes comunes

`frontend`, `backend`, `database`, `whatsapp`, `agent`, `auth`, `leads`, `cli`, `reports`

### Ejemplos

```bash
# Nueva feature
git commit -m "feat(whatsapp): agregar soporte para mensajes de voz"

# Bug fix
git commit -m "fix(leads): corregir validación de nextActionDate en FOLLOW_UP"

# Breaking change
git commit -m "feat(api)!: cambiar endpoint de leads a /api/v2/leads"

# Con body y referencia a issue
git commit -m "fix(auth): corregir expiración de token JWT

El token expiraba antes de lo esperado cuando el servidor
estaba en zona horaria UTC. Se normalizó a ISO 8601.

Closes #42"
```

## Versionado — SemVer

El proyecto sigue [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **PATCH** (`0.0.x`) — fixes y perf sin cambios de API
- **MINOR** (`0.x.0`) — nuevas features retrocompatibles
- **MAJOR** (`x.0.0`) — breaking changes

## Ramas

| Rama | Propósito |
|------|-----------|
| `main` | Producción estable |
| `dev` | Integración continua |
| `<feature>` | Feature branches — mergear a `dev` via PR |

Los commits a `main` y `dev` van siempre via Pull Request.
