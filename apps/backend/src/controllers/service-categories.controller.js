import { asyncHandler } from "../utils/async-handler.js";
import {
  createServiceCategory,
  listActiveServiceCategories,
  listAllServiceCategories,
  setServiceCategoryActive,
  updateServiceCategory
} from "../services/service-categories.service.js";

export const listActive = asyncHandler(async (_req, res) => {
  const categories = await listActiveServiceCategories();
  res.status(200).json({ categories });
});

export const listAll = asyncHandler(async (_req, res) => {
  const categories = await listAllServiceCategories();
  res.status(200).json({ categories });
});

export const create = asyncHandler(async (req, res) => {
  const category = await createServiceCategory({
    actorId: req.user.id,
    payload: req.body ?? {}
  });
  res.status(201).json({ category });
});

export const update = asyncHandler(async (req, res) => {
  const category = await updateServiceCategory({
    actorId: req.user.id,
    categoryId: req.params.id,
    payload: req.body ?? {}
  });
  res.status(200).json({ category });
});

export const toggleActive = asyncHandler(async (req, res) => {
  const category = await setServiceCategoryActive({
    actorId: req.user.id,
    categoryId: req.params.id,
    isActive: Boolean(req.body?.isActive)
  });
  res.status(200).json({ category });
});
