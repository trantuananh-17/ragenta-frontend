/**
 * The Ragenta chat bubble, for somebody else's website.
 *
 *   <script src="https://.../widget.js" data-key="rgpk_..."></script>
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

  var state = { open: false, sending: false };
  var el = {};

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

  function mount(config) {
    var host = document.createElement("div");
    host.setAttribute("data-ragenta-widget", "");
    // A shadow root, so the shop's stylesheet cannot reach in and ours cannot
    // reach out. `open` rather than `closed` deliberately: a site owner should be
    // able to inspect what we put on their page.
    var root = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    var accent = config.accentColor || "#7c3aed";
    var style = document.createElement("style");
    style.textContent = [
      ":host{all:initial}",
      "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}",
      ".launcher{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:" +
        accent +
        ";color:#fff;font-size:24px;box-shadow:0 6px 24px rgba(0,0,0,.22);z-index:2147483000}",
      ".panel{position:fixed;right:20px;bottom:88px;width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);display:none;flex-direction:column;background:#fff;color:#111;border-radius:14px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.24);z-index:2147483000}",
      ".panel.open{display:flex}",
      ".head{padding:14px 16px;background:" + accent + ";color:#fff;font-weight:600;font-size:14px}",
      ".log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f7f7f8}",
      ".msg{max-width:85%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}",
      ".msg.them{background:#fff;border:1px solid #e6e6e9;align-self:flex-start}",
      ".msg.me{background:" + accent + ";color:#fff;align-self:flex-end}",
      ".msg.err{background:#fee;border:1px solid #fcc;color:#900;align-self:flex-start}",
      ".form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}",
      ".form input{flex:1;padding:9px 12px;border:1px solid #ddd;border-radius:9px;font-size:14px;outline:none}",
      ".form input:focus{border-color:" + accent + "}",
      ".form button{padding:0 14px;border:0;border-radius:9px;background:" +
        accent +
        ";color:#fff;cursor:pointer;font-size:14px}",
      ".form button[disabled]{opacity:.5;cursor:default}",
    ].join("");

    var launcher = document.createElement("button");
    launcher.className = "launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", config.title || "Chat");
    launcher.textContent = "💬";

    var panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", config.title || "Chat");

    var head = document.createElement("div");
    head.className = "head";
    head.textContent = config.title || "Chat";

    var log = document.createElement("div");
    log.className = "log";

    var form = document.createElement("form");
    form.className = "form";
    var input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type a message…";
    input.setAttribute("aria-label", "Message");
    var send = document.createElement("button");
    send.type = "submit";
    send.textContent = "Send";

    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    root.appendChild(style);
    root.appendChild(launcher);
    root.appendChild(panel);

    el = { log: log, input: input, send: send };

    launcher.addEventListener("click", function () {
      state.open = !state.open;
      panel.classList.toggle("open", state.open);
      if (state.open) input.focus();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text || state.sending) return;
      input.value = "";
      ask(text);
    });

    if (config.greeting) append("them", config.greeting);
  }

  function append(who, text) {
    var node = document.createElement("div");
    node.className = "msg " + who;
    node.textContent = text;
    el.log.appendChild(node);
    el.log.scrollTop = el.log.scrollHeight;
    return node;
  }

  function setSending(sending) {
    state.sending = sending;
    el.send.disabled = sending;
    el.input.disabled = sending;
  }

  /**
   * Sends a message and streams the answer.
   *
   * `fetch` rather than `EventSource`, because the request is a POST with a body
   * and carries a header — `EventSource` can do neither. The frames are the same
   * shape either way.
   */
  function ask(text) {
    append("me", text);
    setSending(true);

    var bubble = append("them", "…");
    var answer = "";

    fetch(base + "/v1/widget/" + encodeURIComponent(key) + "/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ragenta-visitor": readToken() },
      body: JSON.stringify({ message: text }),
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
            .then(function (body) {
              var refused = new Error("refused");
              refused.visitorMessage = body && body.error && body.error.message;
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

            frames.forEach(function (frame) {
              var payload = "";
              frame.split("\n").forEach(function (line) {
                if (line.indexOf("data:") === 0) payload += line.slice(5).trim();
              });
              if (!payload) return;

              var event;
              try {
                event = JSON.parse(payload);
              } catch {
                return;
              }

              if (event.type === "delta" && typeof event.text === "string") {
                answer += event.text;
                bubble.textContent = answer;
                el.log.scrollTop = el.log.scrollHeight;
              } else if (event.type === "error") {
                bubble.className = "msg err";
                bubble.textContent = event.message || "Something went wrong.";
              }
            });

            return pump();
          });
        }

        return pump();
      })
      .then(function () {
        // A stream that ended with nothing in it is a failure the visitor can
        // see, rather than a bubble that sits on an ellipsis forever.
        if (!answer && bubble.className.indexOf("err") === -1) {
          bubble.className = "msg err";
          bubble.textContent = "Sorry — no answer came back. Please try again.";
        }
      })
      .catch(function (error) {
        bubble.className = "msg err";
        // Only the server's own words, never a thrown network error: "Failed to
        // fetch" is our vocabulary, not something to show a stranger.
        bubble.textContent =
          (error && error.visitorMessage) ||
          "Sorry — the chat is unavailable right now.";
      })
      .then(function () {
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
