import { Router } from "express";
import { requireRole } from "../../middlewares/auth.middleware.js";
import * as leadsController from "../../controllers/leads.controller.js";

const leadsRouter = Router();

leadsRouter.get("/", leadsController.list);
leadsRouter.get("/search", leadsController.searchReferrers);
leadsRouter.post("/", leadsController.create);
leadsRouter.post("/:id/follow-up-quick", leadsController.followUpQuick);
leadsRouter.patch("/:id/status", leadsController.patchStatus);
leadsRouter.post("/:id/activities", leadsController.createActivity);
leadsRouter.post("/:id/whatsapp/send", requireRole('ADMIN'), leadsController.sendWhatsApp);
leadsRouter.patch("/:id", leadsController.patch);
leadsRouter.get("/:id", leadsController.getById);

export default leadsRouter;
