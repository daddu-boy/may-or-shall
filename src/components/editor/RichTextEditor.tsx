"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";

export interface AnnexureOption {
  /** documentId */
  id: string;
  label: string;
  filename: string;
}

/**
 * Live annexure reference (PRD F8): stored as
 * <span data-annexure-id="<docId>">Annexure P-1</span> so renumbering can
 * rewrite the visible label server-side while the reference stays stable.
 */
const AnnexureMention = Mention.extend({
  parseHTML() {
    return [
      {
        tag: "span[data-annexure-id]",
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute("data-annexure-id"),
          label: (el as HTMLElement).textContent,
        }),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "span",
      {
        "data-annexure-id": node.attrs.id,
        class: "annexure-ref",
      },
      node.attrs.label ?? "",
    ];
  },
  renderText({ node }) {
    return node.attrs.label ?? "";
  },
});

function suggestionConfig(
  options: () => AnnexureOption[]
): Omit<SuggestionOptions, "editor"> {
  return {
    char: "@",
    items: ({ query }) =>
      options()
        .filter(
          (o) =>
            o.label.toLowerCase().includes(query.toLowerCase()) ||
            o.filename.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8),
    render: () => {
      let el: HTMLDivElement | null = null;
      let selected = 0;
      let current: SuggestionProps<AnnexureOption> | null = null;

      const draw = () => {
        if (!el || !current) return;
        const items = current.items;
        el.innerHTML = "";
        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "px-3 py-1.5 text-xs text-slate-400";
          empty.textContent = "No annexures — add documents in the Annexures tab";
          el.appendChild(empty);
          return;
        }
        items.forEach((item, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `block w-full text-left px-3 py-1.5 text-xs ${
            i === selected ? "bg-slate-100" : ""
          }`;
          btn.innerHTML = `<span class="font-medium">${item.label}</span> <span class="text-slate-400">${item.filename}</span>`;
          btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            current?.command({ id: item.id, label: item.label });
          });
          el!.appendChild(btn);
        });
      };

      const position = () => {
        if (!el || !current?.clientRect) return;
        const rect = current.clientRect();
        if (!rect) return;
        el.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
        el.style.top = `${rect.bottom + 4}px`;
      };

      return {
        onStart: (props) => {
          current = props as SuggestionProps<AnnexureOption>;
          selected = 0;
          el = document.createElement("div");
          el.className =
            "fixed z-[100] w-80 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white shadow-xl py-1";
          document.body.appendChild(el);
          draw();
          position();
        },
        onUpdate: (props) => {
          current = props as SuggestionProps<AnnexureOption>;
          selected = 0;
          draw();
          position();
        },
        onKeyDown: ({ event }) => {
          if (!current) return false;
          if (event.key === "ArrowDown") {
            selected = (selected + 1) % Math.max(1, current.items.length);
            draw();
            return true;
          }
          if (event.key === "ArrowUp") {
            selected =
              (selected - 1 + Math.max(1, current.items.length)) %
              Math.max(1, current.items.length);
            draw();
            return true;
          }
          if (event.key === "Enter") {
            const item = current.items[selected];
            if (item) current.command({ id: item.id, label: item.label });
            return true;
          }
          if (event.key === "Escape") return true;
          return false;
        },
        onExit: () => {
          el?.remove();
          el = null;
          current = null;
        },
      };
    },
  };
}

export default function RichTextEditor({
  content,
  onChange,
  annexures = [],
  placeholder,
  minHeight = 80,
}: {
  content: string;
  onChange: (html: string) => void;
  annexures?: AnnexureOption[];
  placeholder?: string;
  minHeight?: number;
}) {
  // keep a stable getter so the suggestion always sees the latest registry
  const getAnnexures = () => annexuresRef.current;
  const annexuresRef = { current: annexures };

  const editor = useEditor({
    extensions: [
      StarterKit,
      AnnexureMention.configure({
        suggestion: suggestionConfig(getAnnexures),
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none px-3 py-2 text-sm text-slate-800",
        style: `min-height:${minHeight}px`,
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Sync external content changes (e.g. AI suggestion inserted by the parent).
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  return (
    <div className="rounded-md border border-slate-200 bg-white focus-within:border-slate-400">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-xs font-semibold ${
      active ? "bg-slate-200 text-slate-900" : "text-slate-400 hover:text-slate-700"
    }`;
  return (
    <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${btn(editor.isActive("italic"))} italic`}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        ••
      </button>
      <span className="ml-auto text-[10px] text-slate-300">@ inserts an annexure reference</span>
    </div>
  );
}
