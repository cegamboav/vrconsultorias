import { Router } from "express";
import * as leadsController from "../../controllers/leads.controller.js";

const leadsRouter = Router();

leadsRouter.get("/", leadsController.list);
leadsRouter.post("/", leadsController.create);
leadsRouter.get("/:id", leadsController.getById);
leadsRouter.patch("/:id/status", leadsController.patchStatus);
leadsRouter.post("/:id/activities", leadsController.createActivity);

export default leadsRouter;

