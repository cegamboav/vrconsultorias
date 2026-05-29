import { asyncHandler } from "../utils/async-handler.js";
import { getAssistantCapabilities, processAssistantChat } from "./assistant.service.js";

export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body ?? {};
  const payload = await processAssistantChat({
    userId: req.user.id,
    userName: req.user.name,
    message
  });
  res.status(200).json(payload);
});

export const status = asyncHandler(async (_req, res) => {
  res.status(200).json(getAssistantCapabilities());
});
