import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { answerQuestion } from "./concierge.server";

export const askConcierge = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        message: z.string().trim().min(1, "Ask a question first").max(1000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(4000),
            }),
          )
          .max(12)
          .default([]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => answerQuestion(data.message, data.history));
