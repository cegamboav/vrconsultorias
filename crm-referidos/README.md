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
