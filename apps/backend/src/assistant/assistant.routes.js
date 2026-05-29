import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as assistantController from "./assistant.controller.js";

const assistantRouter = Router();

const assistantChatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas solicitudes al asistente. Espera un momento."
  }
});

assistantRouter.get("/status", assistantController.status);
assistantRouter.post("/chat", assistantChatRateLimit, assistantController.chat);

export default assistantRouter;
