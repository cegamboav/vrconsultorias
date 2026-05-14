import { Router } from "express";
import * as dashboardController from "../../controllers/dashboard.controller.js";

const dashboardRouter = Router();

dashboardRouter.get("/", dashboardController.snapshot);

export default dashboardRouter;
