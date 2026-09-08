import type { ReactNode } from "react";

function inlineText(value: string): ReactNode {
  const pieces = value.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g);
  return pieces.map((piece, index) => {
    if (piece.startsWith("`") && piece.endsWith("`"))
      return <code key={index}>{piece.slice(1, -1)}</code>;
    if (piece.startsWith("**") && piece.endsWith("**"))
      return <strong key={index}>{piece.slice(2, -2)}</strong>;
    return piece;
  });
}

export function SafeArticleBody({ body }: { body: string }) {
  const blocks = body.replaceAll("\r\n", "\n").split(/\n{2,}/);
  return (
    <div className="knowledge-body">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^[-*] /.test(line))) {
          return (
            <ul key={index}>
              {lines.map((line, item) => (
                <li key={item}>{inlineText(line.slice(2))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((line) => /^\d+\. /.test(line))) {
          return (
            <ol key={index}>
              {lines.map((line, item) => (
                <li key={item}>{inlineText(line.replace(/^\d+\. /, ""))}</li>
              ))}
            </ol>
          );
        }
        if (block.startsWith("### ")) return <h3 key={index}>{inlineText(block.slice(4))}</h3>;
        if (block.startsWith("## ")) return <h2 key={index}>{inlineText(block.slice(3))}</h2>;
        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {inlineText(line)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
