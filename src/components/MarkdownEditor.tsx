import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "./theme-provider";
import LZString from "lz-string";
import { Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "katex/dist/katex.min.css";

const DEFAULT_MARKDOWN = `# Markdown Editor

Welcome! You can write **Markdown**, include math with KaTeX:

$$
f(x) = \\int_{-\\infty}^\\infty \\hat{f}(\\xi) e^{2\\pi i \\xi x} d\\xi
$$

And Python code:

\`\`\`python
def hello_world():
    print("Hello, PWA Markdown Editor!")
    
for i in range(5):
    print(i ** 2)
\`\`\`
`;

const MarkdownEditor: React.FC = () => {
  const [markdown, setMarkdown] = useState<string>(() => {
    const saved = localStorage.getItem("markdown_content");
    return saved || DEFAULT_MARKDOWN;
  });
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const { theme } = useTheme();
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef<boolean>(false);

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Scroll Synchronization
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    if (window.innerWidth < 768 || isScrolling.current) return;

    const source = e.currentTarget;
    const target = source === editorRef.current ? previewRef.current : editorRef.current;

    if (target) {
      isScrolling.current = true;
      const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
      target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
      
      // Delay resetting to prevent feedback loops
      setTimeout(() => {
        isScrolling.current = false;
      }, 50);
    }
  };

  // Debounced save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem("markdown_content", markdown);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [markdown]);

  useEffect(() => {
    const updateTheme = () => {
      if (theme === "system") {
        setResolvedTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      } else {
        setResolvedTheme(theme as "light" | "dark");
      }
    };

    updateTheme();
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, [theme]);

  const isRenderOnly = new URLSearchParams(window.location.search).get("view") === "render";

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const compressed = params.get("c");
    if (compressed) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
        if (decompressed) {
          setMarkdown(decompressed);
        }
      } catch (e) {
        console.error("Failed to decompress content from URL", e);
      }
    }
  }, []);

  const handleShare = useCallback(() => {
    const compressed = LZString.compressToEncodedURIComponent(markdown);
    const url = new URL(window.location.href);
    url.searchParams.set("c", compressed);
    url.searchParams.set("view", "render");
    const shareUrl = url.toString();

    if (navigator.share) {
      navigator.share({
        title: "Markdown Share",
        text: "Check out this rendered markdown",
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Rendered view URL copied to clipboard!");
    }
  }, [markdown]);

  const handleExport = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const content = re.target?.result;
        if (typeof content === "string") {
          setMarkdown(content);
        }
      };
      reader.readAsText(file);
    }
  };

  const RenderedMarkdown = useMemo(() => (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          return !inline && match ? (
            <div className="rounded-xl overflow-hidden my-6 border border-border/50 shadow-sm">
              <SyntaxHighlighter
                style={resolvedTheme === "dark" ? vscDarkPlus : vs}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent' }}
                {...props}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className="bg-muted px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>
              {children}
            </code>
          );
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  ), [markdown, resolvedTheme]);

  if (isRenderOnly) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background text-foreground transition-colors duration-500"
      >
        <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
          <article className="prose prose-slate dark:prose-invert max-w-none 
            prose-headings:font-raleway prose-headings:font-bold
            prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
            {RenderedMarkdown}
          </article>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background text-foreground transition-colors duration-500 font-sans overflow-hidden">
      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden border-b border-border/20 shrink-0 bg-background/30 backdrop-blur-2xl sticky top-0 z-40">
        <button
          onClick={() => setActiveTab("editor")}
          className="flex-1 relative py-4 text-[10px] font-black uppercase tracking-[0.2em]"
        >
          <span className={`relative z-10 transition-opacity duration-300 ${activeTab === "editor" ? "opacity-100" : "opacity-40"}`}>Editor</span>
          {activeTab === "editor" && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className="flex-1 relative py-4 text-[10px] font-black uppercase tracking-[0.2em]"
        >
          <span className={`relative z-10 transition-opacity duration-300 ${activeTab === "preview" ? "opacity-100" : "opacity-40"}`}>Preview</span>
          {activeTab === "preview" && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Editor */}
        <AnimatePresence mode="wait">
          {(activeTab === "editor" || window.innerWidth >= 768) && (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`flex-1 flex flex-col md:border-r border-border/20 ${activeTab !== "editor" ? "hidden md:flex" : "flex"}`}
            >
              <div className="hidden md:block px-6 py-3 text-[9px] font-black uppercase tracking-[0.3em] opacity-20 bg-secondary/5 border-b border-border/20">Editor</div>
              <textarea
                ref={editorRef}
                onScroll={handleScroll}
                className="flex-1 p-6 md:p-10 bg-transparent outline-none resize-none font-mono text-sm leading-relaxed placeholder:opacity-10 scrollbar-hide selection:bg-primary/20"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder="Start typing..."
                spellCheck={false}
              />
            </motion.div>
          )}

          {/* Preview */}
          {(activeTab === "preview" || window.innerWidth >= 768) && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`flex-1 flex flex-col bg-secondary/[0.01] ${activeTab !== "preview" ? "hidden md:flex" : "flex"}`}
            >
              <div className="hidden md:block px-6 py-3 text-[9px] font-black uppercase tracking-[0.3em] opacity-20 bg-secondary/5 border-b border-border/20">Preview</div>
              <div 
                ref={previewRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto p-6 md:p-12 scroll-smooth selection:bg-primary/20"
              >
                <article className="prose prose-slate dark:prose-invert max-w-none 
                  prose-headings:font-raleway prose-headings:font-bold
                  prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
                  {RenderedMarkdown}
                </article>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sticky Footer Buttons - Enhanced Glassmorphism */}
        <motion.div 
          initial={{ y: 50, opacity: 0, x: "-50%" }}
          animate={{ y: 0, opacity: 1, x: "-50%" }}
          className="absolute bottom-10 left-1/2 flex items-center gap-1.5 p-1.5 bg-white/5 dark:bg-black/5 backdrop-blur-3xl rounded-full border border-white/20 dark:border-white/5 shadow-[0_8px_40px_rgba(0,0,0,0.08)] z-50 transition-all hover:shadow-[0_8px_48px_rgba(0,0,0,0.12)]"
        >
          <label className="cursor-pointer group">
            <input type="file" accept=".md" onChange={handleImport} className="hidden" />
            <motion.div 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-11 h-11 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center text-foreground/40 group-hover:text-foreground" title="Import"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </motion.div>
          </label>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleExport} 
            className="w-11 h-11 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center text-foreground/40 hover:text-foreground" title="Export"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          </motion.button>
          <div className="w-px h-5 bg-foreground/5 mx-1" />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleShare}
            className="flex items-center gap-2 bg-primary/90 text-primary-foreground px-7 py-3 rounded-full font-bold text-[10px] uppercase tracking-wider hover:bg-primary shadow-xl shadow-primary/10 transition-all"
          >
            <Share2 size={13} strokeWidth={3} />
            <span>Share</span>
          </motion.button>
        </motion.div>
      </main>
    </div>
  );
};


export default MarkdownEditor;
