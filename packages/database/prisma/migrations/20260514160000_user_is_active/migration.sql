-- Soporte multiusuario: activar/desactivar cuentas sin borrarlas.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT TRUE;
