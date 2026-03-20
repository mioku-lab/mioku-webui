import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold">{children}</h4>,
          p: ({ children }) => (
            <p className="text-sm leading-6 text-card-foreground/95">{children}</p>
          ),
          blockquote: ({ children }) => (
            <blockquote className="rounded-r-lg border-l-4 border-primary/60 bg-secondary/15 px-3 py-2 text-sm text-muted-foreground">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="list-inside list-disc space-y-1 text-sm leading-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-inside list-decimal space-y-1 text-sm leading-6">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-border/80" />,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-secondary/35">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-r px-3 py-2 text-left font-semibold last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-r px-3 py-2 align-top last:border-r-0">
              {children}
            </td>
          ),
          code: ({ node, className, children }) => {
            const isBlock =
              Boolean(className) ||
              Boolean(
                node?.position &&
                  node.position.start.line !== node.position.end.line,
              );

            if (!isBlock) {
              return (
                <code className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-[0.82em]">
                  {children}
                </code>
              );
            }

            return <code className="font-mono text-xs leading-5">{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="overflow-auto rounded-lg border bg-secondary/20 p-3">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
