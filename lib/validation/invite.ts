import { z } from "zod";

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
});
