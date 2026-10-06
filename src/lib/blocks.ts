import type { ImageValue, PortableTextBlock } from "emdash";
export interface SectionBlock {
  _heading?: 1 | 2;
  _type: string;
  _version: number;
  _key: string;
  anchor?: string;
  heading?: string;
  eyebrow?: string;
  text?: string;
  theme?: string;
  button_label?: string;
  button_url?: string;
  secondary_label?: string;
  secondary_url?: string;
  image?: ImageValue;
  content?: PortableTextBlock[];
  items?: Array<{
    heading?: string;
    text?: string;
    image?: ImageValue;
    caption?: string;
  }>;
  form_type?:
    "community" | "newsletter" | "artist" | "contact" | "registration";
  limit?: number;
}
export function sectionId(value: SectionBlock) {
  return (value.anchor || value._key).replace(/[^a-zA-Z0-9_-]/g, "-");
}
export function themeClass(value: SectionBlock) {
  return ["paper", "ink", "cobalt", "yellow", "orange", "raspberry"].includes(
    value.theme || "",
  )
    ? `theme-${value.theme}`
    : "theme-paper";
}
