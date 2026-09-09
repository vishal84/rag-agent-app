import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none text-on-surface dark:prose-invert">
      <ReactMarkdown
        components={{
        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-3 mb-2" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-2 mb-1" {...props} />,
        p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 ml-2" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 ml-2" {...props} />,
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-4 border-primary pl-3 italic my-2 text-on-surface-variant" {...props} />
        ),
        code: ({ node, inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || "");
          const lang = match ? match[1] : "text";

          if (inline) {
            return (
              <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          }

          return (
            <div className="my-2 rounded-lg overflow-hidden">
              <SyntaxHighlighter
                style={oneDark}
                language={lang}
                PreTag="div"
                className="!m-0 !p-3 !bg-surface-container-highest text-sm"
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            </div>
          );
        },
        a: ({ node, ...props }) => (
          <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
        ),
        table: ({ node, ...props }) => (
          <table className="border-collapse border border-outline-variant w-full my-2" {...props} />
        ),
        th: ({ node, ...props }) => (
          <th className="border border-outline-variant px-2 py-1 bg-surface-container-high text-left" {...props} />
        ),
        td: ({ node, ...props }) => <td className="border border-outline-variant px-2 py-1" {...props} />,
        hr: ({ node, ...props }) => <hr className="my-4 border-outline-variant" {...props} />,
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
