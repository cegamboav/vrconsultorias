import { Router } from "express";
import * as serviceCategoriesController from "../../controllers/service-categories.controller.js";

const serviceCategoriesRouter = Router();

serviceCategoriesRouter.get("/", serviceCategoriesController.listActive);

export default serviceCategoriesRouter;
