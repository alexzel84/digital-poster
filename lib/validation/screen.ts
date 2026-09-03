import { z } from "zod";

export const createScreenSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const pairScreenSchema = z.object({
  pairingCode: z.string().trim().min(6).max(10),
});

export const unpairScreenSchema = z.object({
  screenId: z.string().uuid(),
});
