/**
 * The Ragenta chat bubble, for somebody else's website.
 *
 *   <script src="https://.../widget.js" data-key="rgpk_..."></script>
 *
 * To tell the agent who is chatting, the host's **server** renders three more
 * attributes — the hash is HMAC-SHA256(identity secret, user id), hex, computed
 * where the secret lives and never in the browser:
 *
 *   <script src="..." data-key="rgpk_..."
 *     data-user-id="42" data-user-email="a@shop.test" data-user-hash="…"></script>
 *
 * **This runs on the customer's own page, and that is the design rather than a
 * shortcut.** The plan was an iframe, and an iframe cannot work here: a request
 * made from inside one carries `Origin: <our domain>`, not the shop's — so the
 * origin allowlist, which is the whole point of a publishable key, would have
 * been decorative. The network has to be owned by code running on the shop's
 * origin for that check to mean anything (ADR-066).
 *
 * The cost is honest: our script is on their page. What it does about that:
 *
 *  - Everything renders inside a **shadow root**, so their CSS cannot break the
 *    chat and ours cannot touch their page.
 *  - It reads nothing outside its own element. No global listeners, no forms, no
 *    cookies, no analytics.
 *  - It is plain ES2019 with no dependencies, so what it does is readable in one
 *    sitting by anybody who wants to check that.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var key = script.getAttribute("data-key");
  if (!key) {
    console.warn("[ragenta] the widget script needs a data-key attribute");
    return;
  }

  /**
   * The API lives where this script came from, so nothing has to be configured
   * twice and a staging embed cannot accidentally talk to production.
   *
   * `/api/v1/...` rather than the backend directly: that path is this app's own
   * proxy, and it forwards the browser's `Origin` header untouched — which is
   * what lets the backend check the shop's origin against the widget's
   * allowlist. Talking to the backend directly would work too; going through the
   * proxy keeps the backend's hostname out of somebody else's page (ADR-066).
   */
  var base = new URL(script.src).origin + "/api";
  var storageKey = "ragenta.visitor." + key;

  /**
   * Who the host site says this is. Only sent when it is signed: an id without
   * a hash is a claim the server would refuse anyway, and sending it would turn
   * a misconfigured page into a chat that refuses every message.
   */
  var userId = script.getAttribute("data-user-id");
  var userHash = script.getAttribute("data-user-hash");
  var visitor = null;
  if (userId && userHash) {
    visitor = { id: userId, hash: userHash };
    var userEmail = script.getAttribute("data-user-email");
    if (userEmail) visitor.email = userEmail;
  } else if (userId) {
    console.warn("[ragenta] data-user-id needs data-user-hash, signed on your server; ignoring it");
  }

  /**
   * Every fixed string in the file. The placeholder is not here on purpose —
   * it comes from the widget's config, like the title and the greeting.
   */
  var LABELS = {
    en: {
      thinking: "Thinking…",
      searchingDocs: "Searching the documents…",
      searchingWeb: "Searching the web…",
      lookingUp: "Looking that up…",
      checkingRecords: "Checking the records…",
      readingPage: "Reading a page…",
      working: "Working on it…",
      readingPassage: "Reading {n} passage…",
      readingPassages: "Reading {n} passages…",
      writing: "Writing the answer…",
      send: "Send",
      stop: "Stop",
      copy: "Copy",
      copied: "Copied",
      close: "Close chat",
      stopped: "Stopped.",
      unavailable: "Sorry — the chat is unavailable right now.",
      noAnswer: "Sorry — no answer came back. Please try again.",
      cannotFinish:
        "Sorry — I can't finish that here. (Site owner: this agent is set to ask before it acts; turn that off for an embedded chat.)",
      poweredBy: "Powered by",
    },
    vi: {
      thinking: "Đang suy nghĩ…",
      searchingDocs: "Đang tìm trong tài liệu…",
      searchingWeb: "Đang tìm trên web…",
      lookingUp: "Đang tra cứu…",
      checkingRecords: "Đang kiểm tra dữ liệu…",
      readingPage: "Đang đọc trang…",
      working: "Đang xử lý…",
      readingPassage: "Đang đọc {n} đoạn…",
      readingPassages: "Đang đọc {n} đoạn…",
      writing: "Đang viết câu trả lời…",
      send: "Gửi",
      stop: "Dừng",
      copy: "Sao chép",
      copied: "Đã sao chép",
      close: "Đóng",
      stopped: "Đã dừng.",
      unavailable: "Xin lỗi — chat hiện không khả dụng.",
      noAnswer: "Xin lỗi — không nhận được câu trả lời. Vui lòng thử lại.",
      cannotFinish:
        "Xin lỗi — tôi không thể hoàn tất việc này ở đây. (Chủ trang: agent này được đặt hỏi trước khi hành động; hãy tắt để dùng cho chat nhúng.)",
      poweredBy: "Powered by",
    },
  };

  var TOOL_LABELS = {
    knowledge_search: "searchingDocs",
    web_search: "searchingWeb",
    api_call: "lookingUp",
    database_query: "checkingRecords",
    http_request: "readingPage",
    browser_read: "readingPage",
  };

  var ICONS = {
    chevron:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    stopped:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none"/></svg>',
  };

  /** The brand mark from favicon.svg, with the tile in the widget's accent. */
  function markSvg(accent) {
    return (
      '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="' +
      accent +
      '"/><g stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M11 16 L21 9.5"/><path d="M11 16 L21 16"/><path d="M11 16 L21 22.5"/></g><g fill="#fff"><circle cx="10.5" cy="16" r="3.1"/><circle cx="21.5" cy="9.5" r="2.1"/><circle cx="21.5" cy="16" r="2.1"/><circle cx="21.5" cy="22.5" r="2.1"/></g></svg>'
    );
  }

  var state = { open: false, sending: false, abort: null };
  var el = {};
  var text = LABELS.en;
  var mark = "";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  var fullClock = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

  /**
   * The visitor token, kept in localStorage so a conversation survives a page
   * reload. It proves nothing and grants nothing — it says "the same browser as
   * before" — so a browser that refuses storage simply starts fresh each time
   * rather than breaking.
   */
  function readToken() {
    try {
      return window.localStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  }

  function writeToken(value) {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Private browsing, or storage disabled. Nothing to do and nothing broken.
    }
  }

  function escapeHtml(source) {
    return source.replace(/[&<>"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  }

  /**
   * ponytail: a deliberate subset of markdown — bold, italic, inline code,
   * http(s) links, flat lists and paragraphs. No headings, tables, images,
   * nested lists or fenced code; an answer using those still reads, just plainer.
   * Swap for a real parser if owners start writing prompts that depend on them.
   *
   * The text is HTML-escaped *before* any pattern runs, so the only markup that
   * can reach `innerHTML` is what this function writes itself.
   */
  function inlineMarkdown(escaped) {
    var codes = [];
    return escaped
      .replace(/`([^`\n]+)`/g, function (_, code) {
        codes.push(code);
        return "\u0000" + (codes.length - 1) + "\u0000";
      })
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
      .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
      .replace(/\u0000(\d+)\u0000/g, function (_, index) {
        return "<code>" + codes[index] + "</code>";
      });
  }

  function renderMarkdown(source, into) {
    var html = "";
    var list = null;
    var paragraph = [];
    function closeParagraph() {
      if (paragraph.length) html += "<p>" + paragraph.join("<br>") + "</p>";
      paragraph = [];
    }
    function closeList() {
      if (list) html += "</" + list + ">";
      list = null;
    }

    // `[[n]]` markers point at a sources list the widget does not show.
    escapeHtml(source.replace(/\[\[\d+\]\]/g, ""))
      .split("\n")
      .forEach(function (line) {
        var item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
        if (item) {
          closeParagraph();
          var kind = /^\s*\d/.test(line) ? "ol" : "ul";
          if (list !== kind) {
            closeList();
            html += "<" + kind + ">";
            list = kind;
          }
          html += "<li>" + inlineMarkdown(item[1]) + "</li>";
        } else if (!line.trim()) {
          closeParagraph();
          closeList();
        } else {
          closeList();
          paragraph.push(inlineMarkdown(line));
        }
      });
    closeParagraph();
    closeList();
    into.innerHTML = html;
  }

  function icon(name, size) {
    var span = document.createElement("span");
    span.className = "icon";
    span.style.width = span.style.height = size + "px";
    span.innerHTML = name === "mark" ? mark : ICONS[name];
    return span;
  }

  function nearBottom() {
    return el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 40;
  }

  function mount(config) {
    var host = document.createElement("div");
    host.setAttribute("data-ragenta-widget", "");
    // A shadow root, so the shop's stylesheet cannot reach in and ours cannot
    // reach out. `open` rather than `closed` deliberately: a site owner should be
    // able to inspect what we put on their page.
    var root = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    // The server validates this shape too; checking again costs one line and the
    // value is written straight into markup on a page that is not ours.
    var accent = /^#[0-9a-f]{6}$/i.test(config.accentColor || "") ? config.accentColor : "#7c3aed";
    var side = config.position === "left" ? "left" : "right";
    var title = config.title || "Chat";
    text = LABELS[config.language] || LABELS.en;
    mark = markSvg(accent);

    var style = document.createElement("style");
    style.textContent = [
      ":host{all:initial}",
      "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}",
      ".icon{display:inline-flex;flex-shrink:0}.icon svg{display:block;width:100%;height:100%}",
      "button{font:inherit;cursor:pointer}",
      ".launcher{position:fixed;" + side + ":20px;bottom:20px;display:flex;align-items:center;justify-content:center;gap:8px;height:56px;min-width:56px;padding:0;border-radius:28px;border:0;background:" +
        accent +
        ";color:#fff;font-size:14px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.22);z-index:2147483000;transition:transform 150ms ease,box-shadow 150ms ease}",
      ".launcher.pill{padding:0 18px 0 14px}",
      ".launcher:hover{transform:scale(1.05);box-shadow:0 10px 32px rgba(0,0,0,.3)}",
      ".launcher:active{transform:scale(.97)}",
      ".launcher .icons{position:relative;width:28px;height:28px}",
      ".launcher .icons .icon{position:absolute;inset:0;transition:opacity 150ms ease}",
      ".launcher .icons .icon:last-child,.launcher.open .icons .icon:first-child{opacity:0}",
      ".launcher.open .icons .icon:last-child{opacity:1}",
      ".panel{position:fixed;" + side + ":20px;bottom:88px;width:380px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 120px);display:none;flex-direction:column;background:#fff;color:#111;border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.24);z-index:2147483000;opacity:0;transform:translateY(12px) scale(.96);transform-origin:bottom " + side + ";transition:opacity 180ms ease-out,transform 180ms ease-out}",
      ".panel.shown{display:flex}",
      ".panel.open{opacity:1;transform:none}",
      "@media (max-width:480px){.panel{left:0;right:0;bottom:0;width:auto;max-width:none;height:calc(100vh - 24px);max-height:none;border-radius:16px 16px 0 0}.launcher.open{display:none}}",
      ".head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:" + accent + ";color:#fff}",
      ".head>.icon{background:rgba(255,255,255,.18);border-radius:7px}",
      ".head h2{flex:1;margin:0;font-size:15px;font-weight:600}",
      ".ghost{display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;opacity:.8}",
      ".ghost:hover{opacity:1;background:rgba(255,255,255,.18)}",
      ".log{flex:1;overflow-y:auto;padding:14px 14px 22px;display:flex;flex-direction:column;gap:18px;background:#f7f7f8}",
      ".row{position:relative;display:flex;align-items:flex-start;gap:8px;font-size:14px;line-height:1.5}",
      ".row.me{justify-content:flex-end}",
      ".bubble{max-width:85%;padding:9px 12px;border-radius:16px 16px 4px 16px;background:" + accent + ";color:#fff;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".avatar{margin-top:3px}",
      ".body{flex:1;min-width:0;overflow-wrap:anywhere}",
      ".body p{margin:0 0 8px}.body ul,.body ol{margin:0 0 8px;padding-left:20px}.body li{margin:2px 0}",
      ".body>:last-child{margin-bottom:0}",
      ".body code{padding:1px 4px;border-radius:4px;background:#ececef;font-size:12.5px}",
      ".body a{color:" + accent + ";text-decoration:underline;text-underline-offset:2px}",
      ".row.err .body{padding:9px 12px;border-radius:12px;background:#fee;border:1px solid #fcc;color:#900}",
      ".foot{position:absolute;top:100%;margin-top:2px;display:flex;align-items:center;gap:6px;opacity:0;transition:opacity 150ms;pointer-events:none;user-select:none}",
      ".me .foot{right:0}.them .foot{left:24px}",
      ".row:hover .foot,.row:focus-within .foot{opacity:1}",
      "@media (hover:none){.foot{opacity:1}}",
      "time{padding:0 4px;border-radius:3px;background:rgba(247,247,248,.9);font-size:11px;line-height:1.3;font-weight:500;color:#6b7280;white-space:nowrap}",
      ".copy{pointer-events:auto;width:20px;height:20px;color:#6b7280;opacity:1}.copy:hover{background:#e6e6e9}",
      ".status{display:flex;align-items:center;gap:8px;margin:0}",
      ".dot{width:8px;height:8px;border-radius:50%;background:" + accent + ";animation:pulse 1.5s ease-in-out infinite}",
      ".shimmer{display:inline-block;background-image:linear-gradient(90deg,transparent calc(50% - 3rem),#111,transparent calc(50% + 3rem)),linear-gradient(#6b7280,#6b7280);background-repeat:no-repeat,padding-box;background-size:250% 100%,auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shimmer 2.4s linear infinite}",
      ".note{display:inline-flex;align-items:center;gap:6px;margin:0;padding:3px 8px;border:1px dashed #d1d5db;border-radius:6px;font-size:12px;color:#6b7280}",
      ".chips{display:flex;flex-wrap:wrap;gap:6px}",
      ".chip{padding:6px 12px;border:1px solid " + accent + ";border-radius:999px;background:#fff;color:" + accent + ";font-size:13px;transition:background 150ms}",
      ".chip:hover{background:" + accent + "1a}",
      ".form{display:flex;align-items:flex-end;gap:8px;padding:10px 10px 6px;border-top:1px solid #e6e6e9;background:#fff}",
      "textarea{flex:1;margin:0;padding:9px 12px;border:1px solid #e6e6e9;border-radius:10px;font:inherit;font-size:14px;line-height:1.45;color:#111;background:#fff;resize:none;outline:none;max-height:120px}",
      "textarea:focus{border-color:" + accent + ";box-shadow:0 0 0 2px " + accent + "40}",
      "textarea[disabled]{background:#f7f7f8}",
      ".send{width:38px;height:38px;border:0;border-radius:10px;background:" + accent + ";color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}",
      ".send[disabled]{opacity:.5;cursor:default}",
      ".powered{margin:0;padding:0 10px 8px;text-align:center;font-size:10.5px;color:#6b7280;background:#fff}",
      ".powered a{color:inherit;text-decoration:none}.powered a:hover{text-decoration:underline}",
      "@keyframes shimmer{from{background-position:100% center}to{background-position:0% center}}",
      "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}",
      "@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}.shimmer{background-image:none;color:#6b7280}}",
    ].join("");

    var launcher = document.createElement("button");
    launcher.className = "launcher" + (config.launcherLabel ? " pill" : "");
    launcher.type = "button";
    launcher.setAttribute("aria-label", title);
    launcher.setAttribute("aria-expanded", "false");
    var icons = document.createElement("span");
    icons.className = "icons";
    icons.appendChild(icon("mark", 28));
    icons.appendChild(icon("chevron", 28));
    launcher.appendChild(icons);
    if (config.launcherLabel) launcher.appendChild(document.createTextNode(config.launcherLabel));

    var panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", title);

    var head = document.createElement("div");
    head.className = "head";
    head.appendChild(icon("mark", 24));
    var heading = document.createElement("h2");
    heading.textContent = title;
    head.appendChild(heading);
    var close = document.createElement("button");
    close.type = "button";
    close.className = "ghost";
    close.style.width = close.style.height = "28px";
    close.setAttribute("aria-label", text.close);
    close.appendChild(icon("close", 18));
    head.appendChild(close);

    var log = document.createElement("div");
    log.className = "log";

    var form = document.createElement("form");
    form.className = "form";
    var input = document.createElement("textarea");
    input.rows = 1;
    input.placeholder = config.placeholder || "Type a message…";
    input.setAttribute("aria-label", config.placeholder || "Message");
    var send = document.createElement("button");
    send.className = "send";
    send.type = "submit";
    send.setAttribute("aria-label", text.send);
    send.appendChild(icon("send", 18));

    var powered = document.createElement("p");
    powered.className = "powered";
    powered.textContent = text.poweredBy + " ";
    var brand = document.createElement("a");
    brand.href = "https://ragenta.com";
    brand.target = "_blank";
    brand.rel = "noopener noreferrer";
    brand.textContent = "Ragenta";
    powered.appendChild(brand);

    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    panel.appendChild(powered);
    root.appendChild(style);
    root.appendChild(launcher);
    root.appendChild(panel);

    el = { log: log, input: input, send: send, chips: null };

    var hideTimer = 0;
    function toggle(open) {
      state.open = open;
      launcher.classList.toggle("open", open);
      launcher.setAttribute("aria-expanded", String(open));
      clearTimeout(hideTimer);
      if (open) {
        panel.classList.add("shown");
        // A frame with `display:flex` and the start values has to be painted
        // before the transition has anything to run from.
        void panel.offsetHeight;
        panel.classList.add("open");
        // `display:none` has no scroll position, so a log filled while the
        // panel was closed (history, a long greeting) would open at the top.
        log.scrollTop = log.scrollHeight;
        input.focus();
      } else {
        panel.classList.remove("open");
        hideTimer = setTimeout(function () {
          panel.classList.remove("shown");
        }, 200);
      }
    }

    launcher.addEventListener("click", function () {
      toggle(!state.open);
    });
    close.addEventListener("click", function () {
      toggle(false);
      launcher.focus();
    });
    panel.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        toggle(false);
        launcher.focus();
      }
    });

    function submitMessage() {
      var value = input.value.trim();
      if (!value || state.sending) return;
      input.value = "";
      input.style.height = "";
      ask(value);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitMessage();
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitMessage();
      }
    });
    input.addEventListener("input", function () {
      input.style.height = "";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });
    send.addEventListener("click", function (event) {
      if (!state.sending) return;
      event.preventDefault();
      if (state.abort) state.abort.abort();
    });

    // The composer waits for history so a message typed now cannot land above
    // the turns that came before it. History is a courtesy, not a gate: after
    // ~3s the chat opens fresh rather than wait on a slow request.
    input.disabled = true;
    send.disabled = true;
    loadHistory().then(function (turns) {
      turns.forEach(appendHistoryTurn);
      if (!turns.length) {
        if (config.greeting) appendAssistant(config.greeting);
        appendQuickQuestions(config.quickQuestions);
      }
      input.disabled = false;
      send.disabled = false;
    });
  }

  /**
   * Earlier turns of this visitor's conversation, oldest first. Any failure —
   * no token, a refusal, a timeout — reads as an empty history: the visitor
   * gets a first-visit chat, not an error.
   */
  function loadHistory() {
    var token = readToken();
    if (!token) return Promise.resolve([]);
    var timeout = new Promise(function (_, reject) {
      setTimeout(reject, 3000);
    });
    var request = fetch(base + "/v1/widget/" + encodeURIComponent(key) + "/history", {
      headers: { "x-ragenta-visitor": token },
    })
      .then(function (response) {
        var issued = response.headers.get("x-ragenta-visitor");
        if (issued) writeToken(issued);
        if (!response.ok) throw new Error("refused");
        return response.json();
      })
      .then(function (payload) {
        var turns = payload && Array.isArray(payload.turns) ? payload.turns : [];
        return turns.filter(function (turn) {
          return turn && typeof turn.question === "string";
        });
      });
    return Promise.race([request, timeout]).catch(function () {
      return [];
    });
  }

  /** One finished turn, drawn exactly as `ask` leaves it. */
  function appendHistoryTurn(turn) {
    var at = new Date(turn.createdAt);
    if (isNaN(at.getTime())) at = new Date();
    var answer = typeof turn.answer === "string" ? turn.answer : "";
    appendVisitor(turn.question, at);
    var row = appendAssistantRow(at);
    if (turn.status === "failed") {
      showError(row, turn.error || text.unavailable);
      return;
    }
    renderMarkdown(answer, row.body);
    if (answer) addCopy(row.foot, answer);
    else if (turn.status === "stopped") row.body.appendChild(stoppedNote());
  }

  function appendQuickQuestions(questions) {
    if (!Array.isArray(questions) || !questions.length) return;
    var chips = document.createElement("div");
    chips.className = "chips";
    questions.forEach(function (question) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = question;
      chip.addEventListener("click", function () {
        if (!state.sending) ask(question);
      });
      chips.appendChild(chip);
    });
    el.log.appendChild(chips);
    el.chips = chips;
  }

  function stamp(row, at) {
    var now = at || new Date();
    var foot = document.createElement("div");
    foot.className = "foot";
    var time = document.createElement("time");
    time.dateTime = now.toISOString();
    time.title = fullClock.format(now);
    time.textContent = clock.format(now);
    foot.appendChild(time);
    row.appendChild(foot);
    return foot;
  }

  function appendRow(who) {
    var row = document.createElement("div");
    row.className = "row " + who;
    el.log.appendChild(row);
    return row;
  }

  function appendVisitor(content, at) {
    var row = appendRow("me");
    var bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = content;
    row.appendChild(bubble);
    stamp(row, at);
    el.log.scrollTop = el.log.scrollHeight;
  }

  /** An assistant row: avatar, body, and the hover stamp under the body's left edge. */
  function appendAssistantRow(at) {
    var row = appendRow("them");
    var avatar = icon("mark", 20);
    avatar.className += " avatar";
    var body = document.createElement("div");
    body.className = "body";
    row.appendChild(avatar);
    row.appendChild(body);
    var foot = stamp(row, at);
    el.log.scrollTop = el.log.scrollHeight;
    return { row: row, body: body, foot: foot };
  }

  function showError(turn, message) {
    turn.row.classList.add("err");
    turn.body.textContent = message;
  }

  function stoppedNote() {
    var note = document.createElement("p");
    note.className = "note";
    note.appendChild(icon("stopped", 14));
    note.appendChild(document.createTextNode(text.stopped));
    return note;
  }

  function addCopy(foot, content) {
    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "ghost copy";
    copy.setAttribute("aria-label", text.copy);
    copy.title = text.copy;
    copy.appendChild(icon("copy", 12));
    copy.addEventListener("click", function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(content).then(function () {
        copy.innerHTML = "";
        copy.appendChild(icon("check", 12));
        copy.title = text.copied;
        setTimeout(function () {
          copy.innerHTML = "";
          copy.appendChild(icon("copy", 12));
          copy.title = text.copy;
        }, 1500);
      }, function () {
        // Clipboard refused (permissions, insecure context). Nothing to show.
      });
    });
    foot.appendChild(copy);
  }

  function appendAssistant(content) {
    var turn = appendAssistantRow();
    renderMarkdown(content, turn.body);
    addCopy(turn.foot, content);
  }

  function setSending(sending) {
    state.sending = sending;
    el.input.disabled = sending;
    el.send.type = sending ? "button" : "submit";
    el.send.setAttribute("aria-label", sending ? text.stop : text.send);
    el.send.innerHTML = "";
    el.send.appendChild(icon(sending ? "stop" : "send", 18));
  }

  /**
   * Sends a message and streams the answer.
   *
   * `fetch` rather than `EventSource`, because the request is a POST with a body
   * and carries a header — `EventSource` can do neither. The frames are the same
   * shape either way.
   */
  function ask(content) {
    if (el.chips) {
      el.chips.remove();
      el.chips = null;
    }
    appendVisitor(content);
    setSending(true);

    var turn = appendAssistantRow();
    var body = turn.body;
    var status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    var dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    var label = document.createElement("span");
    label.className = "shimmer";
    label.textContent = text.thinking;
    status.appendChild(dot);
    status.appendChild(label);
    body.appendChild(status);

    var answer = "";
    var failed = false;
    var controller = new AbortController();
    state.abort = controller;

    /*
      The reveal, ported from the app's `useSmoothText`: tokens land in whatever
      sizes the provider produces, so painting the raw string shows a clause at
      once and then nothing for 300ms. Instead a frame loop drains the backlog
      over ~120ms, with a floor so the tail still visibly moves. `revealed`
      only grows, so the end of the stream can never take words back.
    */
    var revealed = 0;
    var frame = 0;
    var last = 0;

    function paint() {
      var stick = nearBottom();
      renderMarkdown(answer.slice(0, revealed), body);
      if (stick) el.log.scrollTop = el.log.scrollHeight;
    }

    function tick(now) {
      var elapsed = now - last;
      last = now;
      if (revealed < answer.length) {
        var rate = Math.max(0.02, (answer.length - revealed) / 120);
        revealed = Math.min(answer.length, revealed + Math.ceil(rate * elapsed));
        paint();
      }
      frame = requestAnimationFrame(tick);
    }

    function settle() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (revealed < answer.length) {
        revealed = answer.length;
        paint();
      }
    }

    function fail(message) {
      failed = true;
      settle();
      showError(turn, message);
    }

    function setStatus(key, count) {
      label.textContent = text[key].replace("{n}", count);
    }

    function handle(event) {
      if (event.type === "delta" && typeof event.text === "string") {
        if (failed) return;
        answer += event.text;
        if (reducedMotion.matches) {
          revealed = answer.length;
          paint();
        } else if (!frame) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      } else if (event.type === "phase") {
        setStatus(event.phase === "retrieving" ? "searchingDocs" : "writing");
      } else if (event.type === "tool_started") {
        setStatus(Object.prototype.hasOwnProperty.call(TOOL_LABELS, event.name) ? TOOL_LABELS[event.name] : "working");
      } else if (event.type === "citations") {
        var count = Array.isArray(event.citations) ? event.citations.length : 0;
        if (count > 0) setStatus(count === 1 ? "readingPassage" : "readingPassages", count);
      } else if (event.type === "round" || event.type === "node_started") {
        setStatus("writing");
      } else if (event.type === "error") {
        // Only the server's own words, never a thrown network error: "Failed to
        // fetch" is our vocabulary, not something to show a stranger.
        fail(event.message || text.unavailable);
      } else if (event.type === "awaiting_input") {
        // The agent paused for an approval or an answer only a Ragenta
        // member can give. A visitor cannot, so say so rather than
        // sitting on an ellipsis — and tell the owner what to change.
        fail(text.cannotFinish);
      }
    }

    fetch(base + "/v1/widget/" + encodeURIComponent(key) + "/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ragenta-visitor": readToken() },
      body: JSON.stringify(visitor ? { message: content, visitor: visitor } : { message: content }),
      signal: controller.signal,
    })
      .then(function (response) {
        var issued = response.headers.get("x-ragenta-visitor");
        if (issued) writeToken(issued);

        if (!response.ok || !response.body) {
          // A refusal carries a sentence written for this visitor — today's
          // limit reached, the agent not activated yet. Throwing it away and
          // saying "unavailable" is the difference between the shop's owner
          // knowing what to fix and guessing (ADR-065).
          return response
            .json()
            .catch(function () {
              return null;
            })
            .then(function (payload) {
              var refused = new Error("refused");
              refused.visitorMessage = payload && payload.error && payload.error.message;
              throw refused;
            });
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) return;
            buffer += decoder.decode(result.value, { stream: true });

            // Frames are separated by a blank line. Anything after the last one
            // is a partial frame and stays in the buffer.
            var frames = buffer.split("\n\n");
            buffer = frames.pop() || "";

            frames.forEach(function (chunk) {
              var payload = "";
              chunk.split("\n").forEach(function (line) {
                if (line.indexOf("data:") === 0) payload += line.slice(5).trim();
              });
              if (!payload) return;

              var event;
              try {
                event = JSON.parse(payload);
              } catch {
                return;
              }
              if (event && typeof event.type === "string") handle(event);
            });

            return pump();
          });
        }

        return pump();
      })
      .then(function () {
        settle();
        // A stream that ended with nothing in it is a failure the visitor can
        // see, rather than a bubble that sits on an ellipsis forever.
        if (!answer && !failed) fail(text.noAnswer);
      })
      .catch(function (error) {
        if (error && error.name === "AbortError") {
          // The visitor pressed Stop: not an error, the length they asked for.
          settle();
          if (!answer) {
            body.innerHTML = "";
            body.appendChild(stoppedNote());
          }
          return;
        }
        fail((error && error.visitorMessage) || text.unavailable);
      })
      .then(function () {
        if (answer && !failed) addCopy(turn.foot, answer);
        state.abort = null;
        setSending(false);
        el.input.focus();
      });
  }

  /**
   * The first call does two things: it fetches what to render, and it is the
   * request whose `Origin` the server checks. A widget on a page it is not
   * allowed on never gets as far as drawing a button.
   */
  fetch(base + "/v1/widget/" + encodeURIComponent(key) + "/config", {
    headers: { "x-ragenta-visitor": readToken() },
  })
    .then(function (response) {
      if (!response.ok) throw new Error("refused");
      var issued = response.headers.get("x-ragenta-visitor");
      if (issued) writeToken(issued);
      return response.json();
    })
    .then(mount)
    .catch(function () {
      // Deliberately quiet on the page and explicit in the console: a visitor
      // should not see a broken widget, and the site owner should be able to
      // find out why in the place they would look.
      console.warn("[ragenta] this chat is not available on this site");
    });
})();
