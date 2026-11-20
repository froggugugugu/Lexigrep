import { z } from "zod";
import rawSiteConfig from "../../../site.config";

const text = (max: number) => z.string().trim().min(1).max(max);

export const siteConfigSchema = z.object({
  name: text(40),
  description: text(200),
  tagline: text(200),
  baseCourse: z.object({
    goalTitle: text(20),
    shortName: text(20),
    stepTitle: text(30),
  }),
  sample: z
    .object({
      sentence: text(200),
      target: text(60),
      meaning: text(60),
      sourceName: text(40),
      sourceUrl: z.url(),
    })
    .refine((sample) => sample.sentence.includes(sample.target), {
      message: "sample.sentence の中に sample.target が含まれていません",
      path: ["target"],
    }),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

/** `site.config.ts` を検証した値。不正なら起動時に失敗させる */
export const siteConfig: SiteConfig = siteConfigSchema.parse(rawSiteConfig);
