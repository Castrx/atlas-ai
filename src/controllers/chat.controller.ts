import type { Request, Response } from "express";
import { z } from "zod";
import type { ChatService } from "../services/chat.service";
import { ValidationError } from "../errors/validation-error";

const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "message não pode ser vazio"),
});

export type ChatController = ReturnType<typeof createChatController>;

/**
 * Controller do endpoint de chat. Depende somente de ChatService —
 * nunca de LlmProvider, OpenAiProvider ou do SDK da OpenAI diretamente
 * (ver ADR-003 no PROJECT_SPEC.md).
 */
export function createChatController(chatService: ChatService) {
  return {
    async postChat(req: Request, res: Response): Promise<void> {
      const parsed = chatRequestSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new ValidationError(z.prettifyError(parsed.error));
      }

      const reply = await chatService.sendMessage(parsed.data.message);

      res.status(200).json(reply);
    },
  };
}
