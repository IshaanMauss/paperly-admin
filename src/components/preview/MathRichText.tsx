import katex from "katex";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderMixedMath(value: string): string {
  const fragments = (value || "").split(/(\$[^$]+\$)/g);

  return fragments
    .map((fragment) => {
      const isMath = fragment.startsWith("$") && fragment.endsWith("$") && fragment.length > 1;

      if (!isMath) {
        return escapeHtml(fragment).replace(/\n/g, "<br />");
      }

      const mathContent = fragment.slice(1, -1);
      try {
        return katex.renderToString(mathContent, {
          throwOnError: false,
          displayMode: false,
          trust: false,
        });
      } catch {
        return escapeHtml(fragment);
      }
    })
    .join("");
}

export function MathRichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMixedMath(text || "") }}
    />
  );
}
