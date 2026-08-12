import { Router } from "express";
import type { ChatController } from "../controllers/chat.controller";

export function createChatRouter(chatController: ChatController) {
  const router = Router();

  router.post("/chat", chatController.postChat);

  return router;
}
