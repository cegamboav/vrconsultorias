import rateLimit from "express-rate-limit";

export const authLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos de login. Intenta de nuevo en unos minutos."
  }
});
