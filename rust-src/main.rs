use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, bail, Context, Result};
use axum::body::{to_bytes, Body};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::header::{CONNECTION, CONTENT_LENGTH, HOST, TRANSFER_ENCODING};
use axum::http::{HeaderMap, HeaderName, Method, Request, Response, StatusCode, Uri};
use axum::response::{Html, IntoResponse};
use axum::routing::{any, get};
use axum::Router;
use clap::{Args, Parser, Subcommand};
use futures_util::{SinkExt, StreamExt};
use include_dir::{include_dir, Dir, DirEntry};
use reqwest::Client;
use serde_json::Value;
use tokio::net::TcpListener;
use tokio::process::{Child, Command};
use tokio::time::sleep;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::protocol::Message as TungsteniteMessage;
use tower_http::services::{ServeDir, ServeFile};

#[derive(Parser)]
#[command(name = "webpty")]
#[command(about = "Rust runtime scaffold for the WebPTY shell")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Up(UpArgs),
}

#[derive(Args, Clone)]
struct UpArgs {
    #[arg(long, default_value = "127.0.0.1")]
    host: String,
    #[arg(long, default_value_t = 3000)]
    port: u16,
    #[arg(long)]
    funnel: bool,
    #[arg(long)]
    no_build: bool,
}

#[derive(Clone)]
struct AppState {
    bridge_http_base: String,
    bridge_ws_url: String,
    client: Client,
}

struct BridgeProcess {
    child: Child,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum RuntimeRootKind {
    SourceRepo,
    Bundled,
}

#[derive(Clone, Debug)]
struct RuntimeRoot {
    path: PathBuf,
    kind: RuntimeRootKind,
}

static BUNDLED_RUNTIME: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/runtime-assets");

impl BridgeProcess {
    async fn kill(&mut self) {
        if let Err(error) = self.child.kill().await {
            eprintln!("Failed to stop legacy bridge: {error}");
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Up(args) => run_up(args).await,
    }
}

async fn run_up(args: UpArgs) -> Result<()> {
    let runtime_root = resolve_runtime_root()?;

    if runtime_root.kind == RuntimeRootKind::SourceRepo && !args.no_build {
        if let Err(error) = build_runtime_assets(&runtime_root.path).await {
            eprintln!("Build step failed: {error}");
            eprintln!("Continuing without a refreshed frontend bundle.");
        }
    }

    let bridge_port = pick_free_port()?;
    let mut bridge = spawn_legacy_bridge(&runtime_root, bridge_port).await?;
    wait_for_bridge(bridge_port).await?;

    let state = Arc::new(AppState {
        bridge_http_base: format!("http://127.0.0.1:{bridge_port}"),
        bridge_ws_url: format!("ws://127.0.0.1:{bridge_port}/ws"),
        client: Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .context("Failed to create HTTP client.")?,
    });

    let app = build_router(&runtime_root.path, state);
    let listener = TcpListener::bind(format!("{}:{}", args.host, args.port))
        .await
        .with_context(|| format!("Failed to bind {}:{}.", args.host, args.port))?;

    println!("webpty listening on http://{}:{}", args.host, args.port);

    if args.funnel {
        if let Err(error) = start_tailscale_funnel(args.port).await {
            eprintln!("{error}");
            eprintln!(
                "Local app is still available at http://{}:{}",
                args.host, args.port
            );
        }
    }

    let server = axum::serve(listener, app).with_graceful_shutdown(shutdown_signal());
    if let Err(error) = server.await {
        bridge.kill().await;
        return Err(error).context("Rust proxy server exited unexpectedly.");
    }

    bridge.kill().await;
    Ok(())
}

fn resolve_runtime_root() -> Result<RuntimeRoot> {
    if let Ok(path) = env::var("WEBPTY_ROOT") {
        let explicit = PathBuf::from(path);
        if let Some(kind) = detect_runtime_root_kind(&explicit) {
            return Ok(RuntimeRoot {
                path: explicit,
                kind,
            });
        }
    }

    let cwd = env::current_dir().context("Failed to resolve current working directory.")?;
    if let Some(kind) = detect_runtime_root_kind(&cwd) {
        return Ok(RuntimeRoot { path: cwd, kind });
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(kind) = detect_runtime_root_kind(&manifest_dir) {
        return Ok(RuntimeRoot {
            path: manifest_dir,
            kind,
        });
    }

    let bundled = extract_bundled_runtime_root()?;
    if let Some(kind) = detect_runtime_root_kind(&bundled) {
        return Ok(RuntimeRoot {
            path: bundled,
            kind,
        });
    }

    bail!(
        "Could not locate the WebPTY runtime root. Run `webpty up` from the repo with Node dependencies installed, or set WEBPTY_ROOT."
    );
}

fn detect_runtime_root_kind(path: &Path) -> Option<RuntimeRootKind> {
    let source_bridge = path.join("server").join("legacy-bridge.ts");
    let tsx_loader = path.join("node_modules").join("tsx").join("dist").join("loader.mjs");
    if source_bridge.is_file() && tsx_loader.is_file() {
        return Some(RuntimeRootKind::SourceRepo);
    }

    let bundled_bridge = path.join("server").join("legacy-bridge.js");
    let bundled_ws = path.join("node_modules").join("ws").join("package.json");
    if bundled_bridge.is_file() && bundled_ws.is_file() && detect_static_dir(path).is_some() {
        return Some(RuntimeRootKind::Bundled);
    }

    None
}

fn bundled_runtime_cache_dir() -> Result<PathBuf> {
    if cfg!(windows) {
        let base = env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| env::temp_dir());
        return Ok(base.join("webpty").join("runtime").join(env!("CARGO_PKG_VERSION")));
    }

    let base = env::var_os("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache")))
        .unwrap_or_else(env::temp_dir);

    Ok(base.join("webpty").join("runtime").join(env!("CARGO_PKG_VERSION")))
}

fn write_bundled_dir(dir: &Dir<'_>, destination: &Path) -> Result<()> {
    fs::create_dir_all(destination)
        .with_context(|| format!("Failed to create {}.", destination.display()))?;

    for entry in dir.entries() {
        match entry {
            DirEntry::Dir(child) => {
                write_bundled_dir(child, destination)?;
            }
            DirEntry::File(file) => {
                let path = destination.join(file.path());
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent).with_context(|| {
                        format!("Failed to create bundled runtime directory {}.", parent.display())
                    })?;
                }

                fs::write(&path, file.contents())
                    .with_context(|| format!("Failed to write bundled runtime file {}.", path.display()))?;
            }
        }
    }

    Ok(())
}

fn extract_bundled_runtime_root() -> Result<PathBuf> {
    let destination = bundled_runtime_cache_dir()?;
    let ready_marker = destination.join(".ready");

    if ready_marker.is_file() && detect_runtime_root_kind(&destination).is_some() {
        return Ok(destination);
    }

    write_bundled_dir(&BUNDLED_RUNTIME, &destination)?;
    fs::write(&ready_marker, b"ok")
        .with_context(|| format!("Failed to write bundled runtime marker {}.", ready_marker.display()))?;

    Ok(destination)
}

fn build_router(cwd: &Path, state: Arc<AppState>) -> Router {
    let mut router = Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/ws", get(proxy_ws))
        .route("/api/{*path}", any(proxy_api))
        .with_state(state);

    if let Some(static_dir) = detect_static_dir(cwd) {
        let index_file = static_dir.join("index.html");
        let service = axum::routing::get_service(
            ServeDir::new(static_dir).not_found_service(ServeFile::new(index_file)),
        );
        router = router.fallback_service(service);
    } else {
        router = router.fallback(get(static_bundle_missing));
    }

    router
}

fn detect_static_dir(cwd: &Path) -> Option<PathBuf> {
    let candidates = [
        cwd.join("out"),
        cwd.join("output").join("frontend"),
        cwd.join("output").join("static"),
        cwd.join("output").join("web"),
    ];

    candidates
        .into_iter()
        .find(|path| path.join("index.html").is_file())
}

async fn static_bundle_missing() -> Html<&'static str> {
    Html(
        r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>webpty</title>
    <style>
      body {
        margin: 0;
        background: #000;
        color: #fff;
        font: 14px/1.6 "Cascadia Mono", ui-monospace, monospace;
        display: grid;
        min-height: 100vh;
        place-items: center;
      }
      main {
        width: min(42rem, calc(100vw - 3rem));
        border: 1px solid #2b2b2b;
        padding: 1.5rem;
        background: #050505;
      }
      p { color: #b8b8b8; }
      code { color: #fff; }
    </style>
  </head>
  <body>
    <main>
      <h1>Static frontend bundle not found.</h1>
      <p>The Rust proxy and legacy Codex bridge are running, but no exported frontend was found.</p>
      <p>Expected one of: <code>out/</code>, <code>output/frontend/</code>, <code>output/static/</code>, or <code>output/web/</code>.</p>
    </main>
  </body>
</html>"#,
    )
}

async fn proxy_api(
    State(state): State<Arc<AppState>>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    request: Request<Body>,
) -> impl IntoResponse {
    match proxy_http_request(&state, method, uri, headers, request).await {
        Ok(response) => response,
        Err(error) => {
            let payload = serde_json::json!({ "error": error.to_string() }).to_string();
            Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .header("content-type", "application/json; charset=utf-8")
                .body(Body::from(payload))
                .expect("proxy error response")
        }
    }
}

async fn proxy_http_request(
    state: &AppState,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    request: Request<Body>,
) -> Result<Response<Body>> {
    let target = format!("{}{}", state.bridge_http_base, uri);
    let body = to_bytes(request.into_body(), usize::MAX)
        .await
        .context("Failed to buffer incoming request body.")?;

    let mut builder = state.client.request(method, target).body(body.to_vec());
    builder = copy_request_headers(builder, &headers);

    let response = builder.send().await.context("Proxy request failed.")?;
    let status = response.status();
    let response_headers = response.headers().clone();
    let bytes = response
        .bytes()
        .await
        .context("Failed to read proxy response.")?;

    let mut builder = Response::builder().status(status);
    for (name, value) in response_headers.iter() {
        if should_skip_proxy_header(name) {
            continue;
        }

        builder = builder.header(name, value);
    }

    builder
        .body(Body::from(bytes))
        .context("Failed to build proxied response.")
}

fn copy_request_headers(
    mut builder: reqwest::RequestBuilder,
    headers: &HeaderMap,
) -> reqwest::RequestBuilder {
    for (name, value) in headers.iter() {
        if should_skip_proxy_header(name) {
            continue;
        }

        builder = builder.header(name, value);
    }

    builder
}

fn should_skip_proxy_header(name: &HeaderName) -> bool {
    name == HOST || name == CONNECTION || name == CONTENT_LENGTH || name == TRANSFER_ENCODING
}

async fn proxy_ws(
    websocket: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let target = state.bridge_ws_url.clone();
    websocket.on_upgrade(move |socket| async move {
        if let Err(error) = run_ws_proxy(socket, target).await {
            eprintln!("WebSocket proxy failed: {error}");
        }
    })
}

async fn run_ws_proxy(socket: WebSocket, target: String) -> Result<()> {
    let (bridge_stream, _) = connect_async(target)
        .await
        .context("Failed to connect to legacy bridge websocket.")?;
    let (mut client_sender, mut client_receiver) = socket.split();
    let (mut bridge_sender, mut bridge_receiver) = bridge_stream.split();

    let client_to_bridge = async {
        while let Some(message) = client_receiver.next().await {
            let message = message.context("Client websocket read failed.")?;
            if let Some(next_message) = axum_to_tungstenite(message) {
                bridge_sender
                    .send(next_message)
                    .await
                    .context("Failed to forward websocket frame to bridge.")?;
            }
        }

        Result::<()>::Ok(())
    };

    let bridge_to_client = async {
        while let Some(message) = bridge_receiver.next().await {
            let message = message.context("Bridge websocket read failed.")?;
            if let Some(next_message) = tungstenite_to_axum(message) {
                client_sender
                    .send(next_message)
                    .await
                    .context("Failed to forward websocket frame to client.")?;
            }
        }

        Result::<()>::Ok(())
    };

    tokio::select! {
        result = client_to_bridge => result?,
        result = bridge_to_client => result?,
    }

    Ok(())
}

fn axum_to_tungstenite(message: Message) -> Option<TungsteniteMessage> {
    match message {
        Message::Text(text) => Some(TungsteniteMessage::Text(text.to_string().into())),
        Message::Binary(bytes) => Some(TungsteniteMessage::Binary(bytes.to_vec().into())),
        Message::Ping(bytes) => Some(TungsteniteMessage::Ping(bytes.to_vec().into())),
        Message::Pong(bytes) => Some(TungsteniteMessage::Pong(bytes.to_vec().into())),
        Message::Close(_) => None,
    }
}

fn tungstenite_to_axum(message: TungsteniteMessage) -> Option<Message> {
    match message {
        TungsteniteMessage::Text(text) => Some(Message::Text(text.to_string().into())),
        TungsteniteMessage::Binary(bytes) => Some(Message::Binary(bytes)),
        TungsteniteMessage::Ping(bytes) => Some(Message::Ping(bytes)),
        TungsteniteMessage::Pong(bytes) => Some(Message::Pong(bytes)),
        TungsteniteMessage::Close(_) => None,
        TungsteniteMessage::Frame(_) => None,
    }
}

async fn build_runtime_assets(cwd: &Path) -> Result<()> {
    let npm = npm_command();
    let status = Command::new(&npm)
        .arg("run")
        .arg("build")
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .await
        .with_context(|| format!("Failed to run {:?} run build.", npm))?;

    if !status.success() {
        bail!("npm run build exited with status {status}");
    }

    Ok(())
}

fn npm_command() -> OsString {
    if cfg!(windows) {
        OsString::from("npm.cmd")
    } else {
        OsString::from("npm")
    }
}

async fn spawn_legacy_bridge(runtime_root: &RuntimeRoot, port: u16) -> Result<BridgeProcess> {
    let mut command = Command::new("node");

    match runtime_root.kind {
        RuntimeRootKind::SourceRepo => {
            let tsx_loader = runtime_root
                .path
                .join("node_modules")
                .join("tsx")
                .join("dist")
                .join("loader.mjs");
            if !tsx_loader.is_file() {
                bail!(
                    "Missing tsx loader at {}. Install the repo dependencies or use the bundled runtime.",
                    tsx_loader.display()
                );
            }

            let bridge_entry = runtime_root.path.join("server").join("legacy-bridge.ts");
            if !bridge_entry.is_file() {
                bail!(
                    "Missing legacy bridge entrypoint at {}.",
                    bridge_entry.display()
                );
            }

            command.arg("--import").arg(tsx_loader).arg(bridge_entry);
        }
        RuntimeRootKind::Bundled => {
            let bridge_entry = runtime_root.path.join("server").join("legacy-bridge.js");
            if !bridge_entry.is_file() {
                bail!(
                    "Missing bundled legacy bridge entrypoint at {}.",
                    bridge_entry.display()
                );
            }

            command.arg(bridge_entry).env(
                "NODE_PATH",
                runtime_root.path.join("node_modules"),
            );
        }
    }

    command
        .current_dir(&runtime_root.path)
        .env("HOST", "127.0.0.1")
        .env("PORT", port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    let child = command
        .spawn()
        .context("Failed to start the legacy Node bridge process.")?;

    Ok(BridgeProcess { child })
}

async fn wait_for_bridge(port: u16) -> Result<()> {
    let client = Client::new();
    let url = format!("http://127.0.0.1:{port}/healthz");

    for _ in 0..50 {
        if let Ok(response) = client.get(&url).send().await {
            if response.status().is_success() {
                return Ok(());
            }
        }

        sleep(Duration::from_millis(200)).await;
    }

    Err(anyhow!("Legacy bridge did not become ready on {url}."))
}

fn pick_free_port() -> Result<u16> {
    let listener = std::net::TcpListener::bind(("127.0.0.1", 0))
        .context("Failed to allocate a port for the legacy bridge.")?;
    let port = listener
        .local_addr()
        .context("Failed to inspect the legacy bridge socket.")?
        .port();
    drop(listener);
    Ok(port)
}

async fn start_tailscale_funnel(port: u16) -> Result<()> {
    let output = Command::new("tailscale")
        .arg("funnel")
        .arg("--bg")
        .arg("--yes")
        .arg(port.to_string())
        .stdin(Stdio::null())
        .output()
        .await
        .context("Failed to run `tailscale funnel`.")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stdout.trim().is_empty() {
        print!("{stdout}");
    }
    if !stderr.trim().is_empty() {
        eprint!("{stderr}");
    }

    let combined = format!("{stdout}\n{stderr}");
    if combined.contains("Funnel is not enabled on your tailnet.") {
        print_enable_hint().await?;
        bail!("Tailscale Funnel is not enabled for this node.");
    }

    if combined.contains("Access denied: serve config denied") {
        print_operator_hint(port);
        bail!("Tailscale denied serve config access for the current user.");
    }

    if !output.status.success() {
        bail!("`tailscale funnel` exited with status {}", output.status);
    }

    if let Some(url) = public_url_from_status().await? {
        println!("Public URL: {url}");
    }

    Ok(())
}

async fn public_url_from_status() -> Result<Option<String>> {
    let status = tailscale_status().await?;
    let dns_name = status
        .get("Self")
        .and_then(|self_value| self_value.get("DNSName"))
        .and_then(Value::as_str)
        .map(|value| value.trim_end_matches('.'))
        .filter(|value| !value.is_empty())
        .map(|value| format!("https://{value}"));

    Ok(dns_name)
}

async fn print_enable_hint() -> Result<()> {
    let status = tailscale_status().await?;
    if let Some(node_id) = status
        .get("Self")
        .and_then(|self_value| self_value.get("ID"))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
    {
        eprintln!("Enable Funnel for this node first:");
        eprintln!("https://login.tailscale.com/f/funnel?node={node_id}");
    }

    Ok(())
}

fn print_operator_hint(port: u16) {
    eprintln!("Tailscale serve/funnel permission is denied for the current user.");
    eprintln!("Run one of these commands:");
    eprintln!("sudo tailscale set --operator=$USER");
    eprintln!("sudo tailscale funnel --bg --yes {port}");
}

async fn tailscale_status() -> Result<Value> {
    let output = Command::new("tailscale")
        .arg("status")
        .arg("--json")
        .stdin(Stdio::null())
        .output()
        .await
        .context("Failed to run `tailscale status --json`.")?;

    if !output.status.success() {
        bail!(
            "`tailscale status --json` exited with status {}",
            output.status
        );
    }

    serde_json::from_slice(&output.stdout).context("Failed to parse Tailscale status output.")
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}
