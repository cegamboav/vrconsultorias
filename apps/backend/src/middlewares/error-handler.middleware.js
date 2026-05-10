import { AppError } from "../utils/app-error.js";

export function notFoundHandler(_req, _res, next) {
  return next(new AppError("Ruta no encontrada.", 404));
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message =
    error instanceof AppError ? error.message : "Error interno del servidor.";

  if (statusCode === 500) {
    // Log minimo para debugging sin exponer detalles al cliente.
    console.error(error);
  }

  return res.status(statusCode).json({ message });
}
