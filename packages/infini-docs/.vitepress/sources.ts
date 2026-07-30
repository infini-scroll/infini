const QS_INIT = `import { initializeInfini } from "@infini-scroll/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";

async function main() {
  await initializeInfini();
  createRoot(document.getElementById("root")!).render(<App />);
}

main();`;
const MESSAGE_DEF = `type Message = {
  id: string;
  createdAt: string;
  author: string;
  body: string;
  replyTo?: {
    id: string;
    author: string;
    body: string;
  };
};`;
const BACKEND = `class MyBackend {
  constructor(private readonly messages: readonly Message[]) {}

  around(
    timestamp: string | null,
    pageSizeHint: number, // Page size is a hint; you can return more or less than that.
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();

    if (timestamp === null) {
      return this.page(Math.max(0, this.messages.length - pageSizeHint));
    }

    const middle = this.lowerBound(timestamp);
    const start = Math.min(
      Math.max(0, middle - Math.floor(pageSizeHint / 2)),
      Math.max(0, this.messages.length - pageSizeHint),
    );
    return this.page(start, pageSizeHint);
  }

  fromEdge(
    timestamp: string,
    direction: "before" | "after",
    pageSizeHint: number,
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();

    // Include the edge item. Infini deduplicates it by ID, and the overlap
    // proves that this page is continuous with the known items.
    if (direction === "before") {
      const end = this.upperBound(timestamp);
      return this.page(Math.max(0, end - pageSizeHint), pageSizeHint);
    }

    return this.page(this.lowerBound(timestamp), pageSizeHint);
  }

  locateRelative(timestamp: string, offset: number, signal: AbortSignal) {
    signal.throwIfAborted();
    const index = Math.max(
      0,
      Math.min(
        this.messages.length - 1,
        this.lowerBound(timestamp) + offset,
      ),
    );
    const message = this.messages[index];
    return { cursor: message.createdAt, targetId: message.id };
  }

  private page(start: number, pageSize = this.messages.length) {
    // Pages use the half-open range [start, end).
    const end = Math.min(this.messages.length, start + pageSize);
    return {
      items: this.messages.slice(start, end),
      // Exhausted tells Infini to stop requesting on this direction.
      exhaustedBefore: start === 0,
      exhaustedAfter: end === this.messages.length,
    };
  }

  private lowerBound(timestamp: string) {
    // Find the first message at or after the timestamp.
    // Still works even the corresponding message is gone.
    let low = 0;
    let high = this.messages.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.messages[middle].createdAt < timestamp) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  private upperBound(timestamp: string) {
    let low = 0;
    let high = this.messages.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.messages[middle].createdAt <= timestamp) low = middle + 1;
      else high = middle;
    }
    return low;
  }
}

const authors = ["Ada", "Lin"];
const conversations = [
  "Anyone still awake?",
  "Unfortunately yes. My code decided sleep was optional.",
  "Same. I fixed one bug and created three new ones. Productivity 📈",
  "The classic software engineering experience.",
  "My favorite part is when the error says undefined and gives absolutely no emotional support.",
  "Great. We spent two hours improving everything except the thing we needed.",
];

const messages: Message[] = [];
for (let index = 0; index < 200; index += 1) {
  const replyDistance = 1 + ((index * 7) % Math.min(index || 1, 16));
  const repliedMessage =
    index > 4 && (index * 17) % 11 < 3
      ? messages[index - replyDistance]
      : undefined;
  messages.push({
    id: String(index + 1),
    createdAt: new Date(Date.UTC(2026, 0, 1, 9, index)).toISOString(),
    author: authors[index % authors.length],
    body: conversations[index % conversations.length],
    replyTo: repliedMessage && {
      id: repliedMessage.id,
      author: repliedMessage.author,
      body: repliedMessage.body,
    },
  });
}

const FIRST_UNREAD_ID = "121";
const LAST_MESSAGE_ID = messages.at(-1)!.id;
const backend = new MyBackend(messages);

function cursorForMessage(id: string) {
  return messages[Number(id) - 1].createdAt;
}

function locateMessage(items: readonly Message[], id: string) {
  return items.some((message) => message.id === id) ? id : null;
}
`;
const PROVIDER = `const messageProvider: Provider<Message, string, string> = {
  async bootstrap({ cursor, targetSize, signal }) {
    return backend.around(cursor, rowsFor(targetSize), signal);
  },

  async fetch({ cursor, direction, targetSize, signal }) {
    return backend.fromEdge(cursor, direction, rowsFor(targetSize), signal);
  },

  async locateOffset({ anchor, signedItemOffset, signal }) {
    return backend.locateRelative(
      anchor.createdAt,
      signedItemOffset,
      signal,
    );
  },
};

function rowsFor(targetSize: number) {
  return Math.ceil(targetSize / 104) + 4;
}
`;
const SUPPORT = `function messageSize(message: Message) {
  return message.replyTo ? 132 : 94;
}`;
const REACT = `function MessageFeed({
  scrollHost,
  report,
}: {
  scrollHost: HTMLElement;
  report(message: string): void;
}) {
  const { controller, snapshot } = useInfini<
    Message,
    string,
    string,
    string
  >({
    provider: messageProvider,
    ops: {
      getId: (message) => message.id,
      getCursor: (message) => message.createdAt,
    },
    estimateSize: messageSize,
    defaultItemEstimate: 104,
    initial: {
      cursor: cursorForMessage(FIRST_UNREAD_ID),
      target: FIRST_UNREAD_ID,
      alignment: "start",
    },
    targetToCursor: cursorForMessage,
    locateTarget: locateMessage,
    residentBefore: 30,
    residentAfter: 30,
  });

  const hostRef = React.useRef<
    InfiniDomHost<Message, string, string, string> | null
  >(null);
  const scrollToMessage = React.useCallback(
    (id: string, alignment: "center" | "end") => {
      if (!hostRef.current?.scrollToItem(id, alignment)) {
        controller.jump(id, { alignment });
      }
    },
    [controller],
  );
  const scrollToBottom = React.useCallback(
    () => scrollToMessage(LAST_MESSAGE_ID, "end"),
    [scrollToMessage],
  );

  React.useEffect(() => {
    report(
      \`\${snapshot.phase.status} · \${snapshot.layoutItems.length} mounted · \` +
        \`\${snapshot.mainLength} known\`,
    );
  }, [report, snapshot]);

  let notice: React.ReactNode = null;
  if (
    snapshot.phase.status === "dormant" ||
    snapshot.phase.status === "bootstrapping"
  ) {
    notice = <p className="play-message">Loading messages…</p>;
  } else if (snapshot.phase.status === "failed") {
    notice = (
      <div className="play-message" role="alert">
        <p>{snapshot.phase.error.message}</p>
        <button onClick={controller.retry}>Try again</button>
      </div>
    );
  } else if (snapshot.phase.status === "ready" && snapshot.phase.empty) {
    notice = <p className="play-message">No messages yet.</p>;
  }

  return (
    <>
      {notice}
      <InfiniList
        controller={controller}
        scrollHost={scrollHost}
        onHostChange={(host) => {
          hostRef.current = host;
        }}
        rowClassName="message-shell"
        renderItem={(message) => (
          <MessageRow
            message={message}
            onReply={(id) => scrollToMessage(id, "center")}
          />
        )}
      />
      <button
        type="button"
        className="go-to-bottom"
        onClick={scrollToBottom}
      >
        Go to bottom ↓
      </button>
    </>
  );
}

function MessageRow({
  message,
  onReply,
}: {
  message: Message;
  onReply(id: string): void;
}) {
  return (
    <>
      {message.id === FIRST_UNREAD_ID && (
        <div className="unread-divider" role="separator">
          Last unread message
        </div>
      )}
      <article className="message-row">
        {message.replyTo && (
          <blockquote>
            <button
              type="button"
              className="reply-link"
              onClick={() => onReply(message.replyTo!.id)}
            >
              #{message.replyTo.id} · {message.replyTo.author}:{" "}
              {message.replyTo.body}
            </button>
          </blockquote>
        )}
        <header>
          <span className="message-id">#{message.id}</span>
          <strong>{message.author}</strong>
          <time dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </header>
        <p>{message.body}</p>
      </article>
    </>
  );
}`;

const PG_PROLOGUE = `// ======== Message ========
${MESSAGE_DEF}

// ======== Backend ========
${BACKEND}

// ======== Provider ========
${PROVIDER}

// ======== Utils ========
${SUPPORT}`;

const PG_DOM = `import { InfiniController, initializeInfini, type Provider } from "@infini-scroll/core";
import { InfiniDomHost } from "@infini-scroll/dom-support";

${PG_PROLOGUE}

function addGoToBottom(
  viewport: HTMLElement,
  onClick: () => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "go-to-bottom";
  button.textContent = "Go to bottom ↓";
  button.addEventListener("click", onClick);
  viewport.parentElement!.append(button);
  return () => button.remove();
}

// ======== Main ========
export async function mount({
  surface,
  viewport,
  report,
}: PlaygroundContext) {
  await initializeInfini();

  const controller = new InfiniController<Message, string, string, string>({
  provider: messageProvider,
  ops: {
    getId: (message) => message.id,
    getCursor: (message) => message.createdAt,
  },
  estimateSize: messageSize,
  defaultItemEstimate: 104,
  initial: {
    cursor: cursorForMessage(FIRST_UNREAD_ID),
    target: FIRST_UNREAD_ID,
    alignment: "start",
  },
  targetToCursor: cursorForMessage,
  locateTarget: locateMessage,
  residentBefore: 30,
  residentAfter: 30,
  });

  const host = new InfiniDomHost({
  controller,
  container: surface,
  scrollHost: viewport,
  createRow(message) {
    const shell = document.createElement("div");
    shell.className = "message-shell";

    if (message.id === FIRST_UNREAD_ID) {
    const divider = document.createElement("div");
    divider.className = "unread-divider";
    divider.setAttribute("role", "separator");
    divider.textContent = "Last unread message";
    shell.append(divider);
    }

    const article = document.createElement("article");
    article.className = "message-row";
    if (message.replyTo) {
    const quote = document.createElement("blockquote");
    const reply = document.createElement("button");
    reply.type = "button";
    reply.className = "reply-link";
    reply.textContent =
      "#" +
      message.replyTo.id +
      " · " +
      message.replyTo.author +
      ": " +
      message.replyTo.body;
    reply.addEventListener("click", () => {
      controller.jump(message.replyTo!.id, { alignment: "center" });
    });
    quote.append(reply);
    article.append(quote);
    }

    const header = document.createElement("header");
    const messageId = document.createElement("span");
    messageId.className = "message-id";
    messageId.textContent = "#" + message.id;
    const author = document.createElement("strong");
    author.textContent = message.author;
    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    });
    header.append(messageId, author, time);

    const body = document.createElement("p");
    body.textContent = message.body;
    article.append(header, body);
    shell.append(article);
    return shell;
  },
  });

  const removeGoToBottom = addGoToBottom(viewport, () => {
  controller.jump(LAST_MESSAGE_ID, { alignment: "end" });
  });
  const unsubscribe = controller.subscribe(() => {
  const snapshot = controller.getSnapshot();
  report(
    \`\${snapshot.phase.status} \${snapshot.layoutItems.length} mounted \${snapshot.mainLength} known\`,
  );
  });

  controller.start();

  return () => {
  removeGoToBottom();
  unsubscribe();
  host.dispose();
  controller.dispose();
  };
}
`;

const PG_REACT = `import * as React from "react";
import { createRoot } from "react-dom/client";
import { initializeInfini, type Provider } from "@infini-scroll/core";
import type { InfiniDomHost } from "@infini-scroll/dom-support";
import { InfiniList, useInfini } from "@infini-scroll/react";

${PG_PROLOGUE}

// ======== Main ========
${REACT}

export async function mount({
  surface,
  viewport,
  report,
}: PlaygroundContext) {
  await initializeInfini();
  const root = createRoot(surface);
  root.render(<MessageFeed scrollHost={viewport} report={report} />);
  return () => root.unmount();
}
`;

const QS_CSS = `.message-shell {
  width: 100%;
  padding: 5px 12px;
  box-sizing: border-box;
}

.message-row {
  padding: 10px 12px;
  border: 1px solid CanvasText;
  border-radius: 8px;
}

.message-row header {
  display: flex;
  gap: 8px;
}

.message-id {
  opacity: 0.65;
  font-family: monospace;
}

.message-row blockquote {
  margin: 0 0 8px;
  padding-left: 8px;
  border-left: 2px solid currentColor;
}

.reply-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.unread-divider {
  margin-bottom: 8px;
  color: LinkText;
  text-align: center;
}

.go-to-bottom {
  position: absolute;
  z-index: 1;
  right: 16px;
  bottom: 16px;
}

.feed-notice {
  position: absolute;
  z-index: 1;
  inset: 16px auto auto 16px;
}`;
const QS_PAGE = `type Page<T> = {
  items: readonly T[];
  exhaustedBefore: boolean;
  exhaustedAfter: boolean;
};`;
const QS_CURSOR_SLICE = `const end = this.upperBound(timestamp);
const start = Math.max(0, end - pageSize);
const items = this.messages.slice(start, end);`;
const QS_OPS = `ops: {
  getId: (message) => message.id,
  getCursor: (message) => message.createdAt,
}`;
const QS_PAGE_SIZE = "const pageSize = Math.ceil(targetSize / 104) + 4;";
const QS_FEED = `function FeedPanel() {
  const [scrollHost, setScrollHost] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setScrollHost} className="feed-viewport">
      {scrollHost ? <MessageFeed scrollHost={scrollHost} /> : null}
    </div>
  );
}`;
const QS_VIEWPORT = `.feed-viewport {
  position: relative;
  height: 70vh;
  overflow: auto;
  overscroll-behavior: contain;
}`;
const QS_LOCATE_OFFSET = `async locateOffset({ anchor, signedItemOffset, signal }) {
  return backend.locateRelative(anchor.createdAt, signedItemOffset, signal);
}`;
const QS_CUSTOM_WASM =
    'await initializeInfini(new URL("/assets/infini_wasm_bg.wasm", location.href));';

export const playgrounds = [
    {
        name: "DOM",
        label: "Raw DOM",
        fileName: "quick-start.ts",
        language: "typescript",
        default: false,
        source: PG_DOM,
    },
    {
        name: "React",
        label: "React (TSX)",
        fileName: "quick-start.tsx",
        language: "typescript",
        default: true,
        source: PG_REACT,
    },
] as const;

export const codeBlocks = {
    quickStartInitialize: {
        lang: "tsx",
        source: QS_INIT,
    },
    quickStartMessage: { lang: "ts", source: MESSAGE_DEF },
    quickStartBackend: { lang: "ts", source: BACKEND },
    quickStartProvider: { lang: "ts", source: PROVIDER },
    quickStartPageType: { lang: "ts", source: QS_PAGE },
    quickStartReact: { lang: "tsx", source: REACT },
    quickStartCss: { lang: "css", source: QS_CSS },
    quickStartCursorSlice: {
        lang: "ts",
        source: QS_CURSOR_SLICE,
    },
    quickStartOps: { lang: "ts", source: QS_OPS },
    quickStartPageSize: { lang: "ts", source: QS_PAGE_SIZE },
    quickStartFeedPanel: {
        lang: "tsx",
        source: QS_FEED,
    },
    quickStartViewportCss: {
        lang: "css",
        source: QS_VIEWPORT,
    },
    quickStartLocateOffset: {
        lang: "ts",
        source: QS_LOCATE_OFFSET,
    },
    quickStartCustomWasm: {
        lang: "ts",
        source: QS_CUSTOM_WASM,
    },
} as const;
