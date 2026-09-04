import { z } from "zod";

export const createScreenSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  address: z.string().trim().max(200).optional(),
  businessType: z.string().trim().max(100).optional(),
});

export const renameScreenSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const updateScreenSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().max(200).nullable().optional(),
  businessType: z.string().trim().max(100).nullable().optional(),
});

export const duplicateScreenSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export const pairScreenSchema = z.object({
  pairingCode: z.string().trim().min(6).max(10),
});

export const unpairScreenSchema = z.object({
  screenId: z.string().uuid(),
});
