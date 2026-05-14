import { Router } from "express";
import * as leadsController from "../../controllers/leads.controller.js";

const leadsRouter = Router();

leadsRouter.get("/", leadsController.list);
leadsRouter.get("/search", leadsController.searchReferrers);
leadsRouter.post("/", leadsController.create);
leadsRouter.post("/:id/follow-up-quick", leadsController.followUpQuick);
leadsRouter.patch("/:id/status", leadsController.patchStatus);
leadsRouter.post("/:id/activities", leadsController.createActivity);
leadsRouter.patch("/:id", leadsController.patch);
leadsRouter.get("/:id", leadsController.getById);

export default leadsRouter;
