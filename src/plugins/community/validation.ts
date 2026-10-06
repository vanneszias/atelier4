import { z } from "zod";
export const submissionSchema = z
  .object({
    submissionId: z.uuid(),
    type: z.enum([
      "community",
      "newsletter",
      "artist",
      "contact",
      "registration",
    ]),
    locale: z.enum(["nl", "en"]),
    name: z.string().trim().min(1).max(120),
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    discipline: z.string().trim().max(300).default(""),
    message: z.string().trim().max(5000).default(""),
    updates: z.boolean().default(false),
    help: z.boolean().default(false),
    consent: z.literal(true),
    eventId: z.string().max(120).default(""),
    website: z.string().max(300).default(""),
    turnstileToken: z.string().max(2048).default(""),
  })
  .superRefine((data, ctx) => {
    if (data.type === "newsletter" && !data.updates)
      ctx.addIssue({
        code: "custom",
        path: ["updates"],
        message: "Updates consent required",
      });
    if (data.type === "contact" && !data.message)
      ctx.addIssue({
        code: "custom",
        path: ["message"],
        message: "Message required",
      });
    if (data.type === "artist" && !data.discipline)
      ctx.addIssue({
        code: "custom",
        path: ["discipline"],
        message: "Art form required",
      });
    if (data.type === "registration" && !data.eventId)
      ctx.addIssue({
        code: "custom",
        path: ["eventId"],
        message: "Event required",
      });
  });
export type Submission = z.infer<typeof submissionSchema>;
