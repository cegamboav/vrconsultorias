# CRM Referidos - Entorno Local de Desarrollo

Base del MVP para gestion de leads y seguimiento comercial, con entorno local completo para frontend, backend y base de datos usando Docker + Prisma.

## Stack

- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- ORM: Prisma

## Estructura de carpetas

```txt
crm-referidos/
  apps/
    frontend/                # React + Vite + Tailwind
    backend/                 # Express API
  packages/
    database/                # Prisma schema + Prisma Client
  docs/
    technical-spec.md
  .env.example
  package.json               # Workspaces y scripts globales
```

## Requisitos

- Node.js 20+
- Docker Desktop (con Docker Compose)
- npm 10+

## Variables de entorno

Crea tu archivo local desde el ejemplo:

```bash
cp .env.example .env
```

Variables principales:

- `PORT=4000` (backend)
- `FRONTEND_URL=http://localhost:5173`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`
- `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`, `PGADMIN_PORT`
- `DATABASE_URL` (conexion Prisma)
- `OPENAI_API_KEY` (asistente interno — fase 1; opcional hasta probar el chat)
- `OPENAI_MODEL` (opcional, por defecto `gpt-4o-mini`)

## Levantar entorno completo (instalacion inicial)

1. Instalar dependencias Node:

```bash
npm install
```

2. Levantar PostgreSQL y pgAdmin:

```bash
npm run db:up
```

3. Generar Prisma Client:

```bash
npm run prisma:generate
```

4. Aplicar migraciones:

```bash
npm run prisma:migrate
```

5. (Opcional) Cargar datos de ejemplo:

```bash
npm run seed
```

6. Levantar frontend y backend:

```bash
npm run dev
```

## Autenticacion MVP

- Endpoint login: `POST /auth/login`
- Endpoint sesion: `GET /auth/me` (requiere Bearer token)
- Ruta protegida de prueba: `GET /api/protected`
- Ruta solo admin de prueba: `GET /auth/admin-only`
- Seguridad base: `Helmet` + `CORS` explícito + rate limit en login

Credenciales admin seed:

- Email: `admin@crmreferidos.local`
- Password: `admin123`

## Scripts basicos (raiz)

- `npm run setup`: instalacion inicial automatizada (deps + db + prisma migrate)
- `npm run dev`: corre frontend y backend en paralelo
- `npm run dev:frontend`: corre solo frontend (`http://localhost:5173`)
- `npm run dev:backend`: corre solo backend (`http://localhost:4000`)
- `npm run db:up`: levanta PostgreSQL y pgAdmin en Docker
- `npm run db:down`: apaga contenedores
- `npm run db:down:volumes`: apaga y borra volumenes (reset DB)
- `npm run db:logs`: logs en vivo de PostgreSQL y pgAdmin
- `npm run build`: build frontend + backend
- `npm run start`: inicia backend en modo produccion
- `npm run prisma:generate`: genera Prisma Client
- `npm run prisma:migrate`: crea/aplica migraciones en desarrollo
- `npm run prisma:deploy`: aplica migraciones en modo deploy
- `npm run seed`: ejecuta seed Prisma
- `npm run prisma:studio`: abre Prisma Studio
- `npm run lint`: lint frontend + backend
- `npm run format`: revisa formato con Prettier

## Endpoints iniciales

- `GET /` -> informacion basica de la API
- `GET /api/health` -> estado del servicio

## Leads (API privada, requiere Bearer)

Estados del pipeline (enum): `NEW`, `CONTACTED`, `RESPONDED`, `SCHEDULED`, `FOLLOW_UP`, `CLOSED_INVESTED`, `CLOSED_NOT_INVESTED`. En cierre sin inversión se exige `noInvestmentReason`.

### Dashboard operativo

- `GET /api/private/dashboard` — resumen para el panel (pipeline, seguimientos, cierres, actividad).

Endpoints de leads:
- `GET /api/private/leads`
- `POST /api/private/leads`
- `GET /api/private/leads/:id`
- `PATCH /api/private/leads/:id` (edición de datos; registra actividad `LEAD_UPDATED`)
- `PATCH /api/private/leads/:id/status`
- `POST /api/private/leads/:id/activities`

Tras cambiar el modelo de estados, aplica migraciones: `npm run prisma:migrate` (incluye script `20260513140000_lead_pipeline_explicit_statuses`).

## Asistente IA interno (fase 1 — backend)

Arquitectura: **interpretación (OpenAI) → validación → servicios existentes (`leads.service` / `activities.service`) → Prisma**. La IA no accede a Prisma ni ejecuta SQL.

Requiere `OPENAI_API_KEY` en `.env` (raíz del monorepo o cwd del backend según cómo arranques la API).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/private/assistant/status` | Estado del asistente (configurado, acciones soportadas) |
| `POST` | `/api/private/assistant/chat` | Mensaje en lenguaje natural → interpretación + ejecución segura |

Ejemplo de cuerpo:

```json
{ "message": "Pon a Carlos en seguimiento 15 días" }
```

Respuesta típica: `interpretation`, `executed`, `result`, `reply`.

Acciones soportadas en esta fase:

- Buscar lead por nombre (`SEARCH_LEAD_BY_NAME`)
- Cambiar estado (`MOVE_LEAD_STATUS`) — respeta transiciones del pipeline
- Programar seguimiento (`SCHEDULE_FOLLOW_UP` / sinónimo `MOVE_TO_FOLLOW_UP`) — días 7, 15, 30 o 90
- Agregar nota (`ADD_NOTE`)

Auditoría: cada chat y cada acción ejecutada se registran en `AuditLog`; las acciones sobre leads dejan huella en el timeline con `metadata.source = "assistant"`.

Prueba rápida (con token JWT):

```bash
curl -s -X POST http://localhost:4000/api/private/assistant/chat \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Busca leads llamados Carlos\"}"
```

## Accesos locales

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Healthcheck API: `http://localhost:4000/api/health`
- pgAdmin: `http://localhost:5050`

## Configuracion pgAdmin (primera vez)

1. Entrar a `http://localhost:5050`
2. Login con `PGADMIN_DEFAULT_EMAIL` y `PGADMIN_DEFAULT_PASSWORD`
3. Crear server connection:
   - Host: `postgres`
   - Port: `5432`
   - User: valor de `POSTGRES_USER`
   - Password: valor de `POSTGRES_PASSWORD`

## Solucion de problemas

- Si Prisma no conecta, verifica que `postgres` este healthy: `npm run db:logs`
- Si necesitas reset completo de DB: `npm run db:down:volumes && npm run db:up`
- Si cambias `schema.prisma`, vuelve a correr `npm run prisma:migrate`

## Proximo paso recomendado

Implementar modulo de autenticacion (usuarios/roles) y CRUD de leads con reglas del pipeline del documento tecnico.
