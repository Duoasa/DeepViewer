function BrowserView(props) {
  if (!window.deepviewerDesktop?.onBrowserOpen) return react.createElement(LegacyBrowserView, props);
  const { tab, ctx } = props;
  const initial = tab.meta?.browserUrl ?? tab.path;
  const host = react.useRef(null);
  const guest = react.useRef(null);
  const [address, setAddress] = react.useState(initial ?? "");
  const [status, setStatus] = react.useState({ back: false, forward: false, loading: false, error: "" });
  const save = patch => ctx.get("betterSidebar")?.updateTab(tab.id, patch);
  const navigate = raw => {
    let url;
    try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); } catch { return; }
    if (!["http:", "https:"].includes(url.protocol)) return;
    setAddress(url.href);
    if (guest.current) guest.current.loadURL(url.href).catch(() => {});
    else mount(url.href);
  };
  const mount = url => {
    const view = document.createElement("webview");
    view.setAttribute("partition", "persist:deepviewer-browser");
    view.setAttribute("allowpopups", "");
    view.style.cssText = "display:flex;flex:1;width:100%;height:100%;min-height:0;background:white";
    const update = () => {
      try {
        const current = view.getURL();
        setAddress(current);
        setStatus({ back: view.canGoBack(), forward: view.canGoForward(), loading: view.isLoading(), error: "" });
        save({ title: view.getTitle() || new URL(current).hostname, meta: { ...tab.meta, browserUrl: current } });
      } catch (error) { console.warn("Browser state update failed", String(error)); }
    };
    for (const name of ["dom-ready", "did-navigate", "did-navigate-in-page", "page-title-updated", "did-stop-loading"]) view.addEventListener(name, update);
    view.addEventListener("did-start-loading", () => setStatus(s => ({ ...s, loading: true, error: "" })));
    view.addEventListener("did-fail-load", event => {
      if (event.isMainFrame && event.errorCode !== -3) setStatus(s => ({ ...s, loading: false, error: `页面加载失败：${event.errorDescription}` }));
    });
    view.src = url;
    guest.current = view;
    host.current.append(view);
  };
  react.useEffect(() => {
    if (initial) mount(initial);
    return () => { guest.current?.remove(); guest.current = null; };
  }, [tab.id]);
  const button = (label, text, action, disabled = false) => react.createElement("button", {
    type: "button", title: label, "aria-label": label, disabled, onClick: action,
    className: sidebar_module_css_default.iconButton,
  }, text);
  return react.createElement("div", { className: sidebar_module_css_default.browser },
    react.createElement("form", { className: sidebar_module_css_default.browserBar, onSubmit: event => { event.preventDefault(); navigate(address.trim()); } },
      button("后退", "‹", () => guest.current?.goBack(), !status.back),
      button("前进", "›", () => guest.current?.goForward(), !status.forward),
      button(status.loading ? "停止" : "刷新", status.loading ? "×" : "↻", () => status.loading ? guest.current?.stop() : guest.current?.reload()),
      react.createElement("input", { className: sidebar_module_css_default.browserInput, "aria-label": "网址", placeholder: "输入网址", value: address, onChange: e => setAddress(e.target.value) })),
    status.error && react.createElement("div", { role: "status", style: { padding: "8px 12px", color: "var(--dsw-alias-label-secondary)" } }, status.error),
    react.createElement("div", { ref: host, style: { display: "flex", flex: 1, minHeight: 0, overflow: "hidden" } }));
}
