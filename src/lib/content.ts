import type { PortableTextBlock } from "emdash";

// Old starter entries used the exact same plain paragraph for their teaser
// and body. Keep a single introduction, preserving rich and distinct content.
export function withoutRepeatedIntro(
  content: PortableTextBlock[] | undefined,
  excerpt?: string,
) {
  const blocks = content || [];
  const first = blocks[0];
  if (!first || first._type !== "block" || first.style !== "normal" || !excerpt)
    return blocks;
  const children = Array.isArray(first.children) ? first.children : [];
  const plain = children.every(
    (span: any) => span._type === "span" && !span.marks?.length,
  );
  const text = children
    .map((span: any) => span.text || "")
    .join("")
    .trim();
  return plain && text === excerpt.trim() ? blocks.slice(1) : blocks;
}
