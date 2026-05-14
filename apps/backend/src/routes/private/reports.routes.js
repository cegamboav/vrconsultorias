import { Router } from "express";
import * as reportsController from "../../controllers/reports.controller.js";

const reportsRouter = Router();

reportsRouter.get("/", reportsController.snapshot);

export default reportsRouter;
