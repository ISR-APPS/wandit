//! App setup of the desktop shell (docs/v2/desktop-apps.md, sections 3, 5, 9, and 10).
//! main.rs calls `run`. It opens and migrates the database before the window exists.
//! Then it creates the locked main window and the native menu (app-wide on macOS), and
//! registers the 4 commands of db.rs. The lock covers navigation, the CSP of each answer,
//! downloads, and the network.
//! It also runs the updater flow. backup.rs holds the File menu actions.
//! With `--wandit-self-test`, `run` only tests the embedded migrations for the CI, then exits.

mod backup;
mod db;

use db::{DbError, DbErrorCode};
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, MutexGuard, PoisonError,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{
    http::{header::CONTENT_SECURITY_POLICY, HeaderMap, HeaderValue},
    menu::{Menu, MenuBuilder, MenuEvent, SubmenuBuilder},
    webview::NewWindowResponse,
    App, AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, Wry,
};
use tauri_plugin_dialog::{
    DialogExt, MessageDialogBuilder, MessageDialogButtons, MessageDialogKind,
};
use tauri_plugin_updater::UpdaterExt;

/// Label of the one window of the app. The capability `main` grants the 4 commands to it.
pub(crate) const MAIN_WINDOW: &str = "main";

// Ids of the native menu items (section 3).
const MENU_BACKUP: &str = "backup_now";
const MENU_EXPORT: &str = "export_data";
const MENU_IMPORT: &str = "import_data";
const MENU_QUIT: &str = "quit";
const MENU_CHECK_UPDATES: &str = "check_updates";
const MENU_ABOUT: &str = "about";

/// True while an update check or install runs. It stops a second dialog and a second install.
static UPDATE_FLOW_RUNNING: AtomicBool = AtomicBool::new(false);

/// End of the "Update failed" text when the install fails. macOS runs an app from Downloads or
/// from the disk image at a random read-only path (App Translocation). The update then fails.
#[cfg(target_os = "macos")]
const INSTALL_FAILED_HINT: &str = "\n\nOpen the app from the Applications folder, then try again.";
#[cfg(not(target_os = "macos"))]
const INSTALL_FAILED_HINT: &str = "";

/// Argument 1 that starts the self-test (section 9). `build.yml` runs the installed exe with it.
const SELF_TEST_FLAG: &str = "--wandit-self-test";
/// `app_version` of the self-test ledger rows. The temp database is deleted at the end.
const SELF_TEST_APP_VERSION: &str = "self-test";

/// Browser args of the WebView2 of the main window. The app has no remote network. These args
/// close the channels that the CSP does not control:
/// - the wry default `--disable-features=...`, because a custom value replaces it;
/// - a proxy on loopback port 1, where Windows has no service, so no TCP request reaches a host;
/// - the WebRTC policy `disable_non_proxied_udp`, so WebRTC sends no UDP;
/// - a resolver rule that fails every host name, so DNS prefetch and WebRTC send no DNS query.
///
/// wry answers `tauri.localhost` and `ipc.localhost` itself, before the network stack.
/// macOS uses `locked_webview_configuration` and a loopback proxy instead.
#[cfg(windows)]
const WEBVIEW2_BROWSER_ARGS: &str = concat!(
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
    " --proxy-server=http://127.0.0.1:1",
    " --force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    " --host-resolver-rules=\"MAP * ~NOTFOUND\"",
);

/// macOS only: a proxy on loopback port 1, where no service listens. An HTTP load that the
/// CSP does not govern (for example a preconnect) then reaches no host. It does not stop
/// WebRTC; `locked_webview_configuration` does. Needs macOS 14 or later (D36 sets 15).
#[cfg(target_os = "macos")]
const LOOPBACK_PROXY_URL: &str = "http://127.0.0.1:1";

/// Files of the app on the user machine (section 5). On Windows the base folder is
/// `%LOCALAPPDATA%\<identifier>`. On macOS the base folder is
/// `~/Library/Application Support/<identifier>`.
pub(crate) struct DataPaths {
    /// `<base>/data`. The import also stages its file here, so the swap is a rename on one disk.
    pub data_dir: PathBuf,
    /// `<base>/data/app.db`.
    pub db_file: PathBuf,
    /// `<base>/backups`.
    pub backups_dir: PathBuf,
}

/// State of the app database.
pub(crate) enum DbState {
    /// The runner finished and the authorizer is installed.
    Ready(Connection),
    /// The file did not open or migrate. Holds the reason. The commands answer `migration_failed`.
    /// No connection to the file is open in this state.
    Failed(String),
}

/// The app database: managed Tauri state, shared by the commands, the menu, and the updater.
pub(crate) struct AppDatabase {
    pub paths: DataPaths,
    state: Mutex<DbState>,
    /// The webview commands wait here and run one at a time. A call runs after each call that the
    /// app awaited before it. A waiting command holds no thread, so a stuck command never blocks
    /// the async workers of the update check.
    command_turn: tauri::async_runtime::Mutex<()>,
}

impl AppDatabase {
    /// Locks the state. Every call on the app connection holds this lock, so the calls run one
    /// at a time.
    pub fn lock(&self) -> MutexGuard<'_, DbState> {
        // The shell code has no panic path while it holds the lock, so a poisoned lock
        // means a bug. The app then keeps working instead of failing every later command.
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Runs a menu or updater action with the open connection. Answers the reason when
    /// the database did not open.
    pub fn with_connection<T>(
        &self,
        action: impl FnOnce(&Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        match &*self.lock() {
            DbState::Ready(conn) => action(conn),
            DbState::Failed(reason) => Err(format!("The data is not available. {reason}")),
        }
    }

    // Runs a command body with the open connection and the time limit of db.rs, or answers
    // `migration_failed`.
    fn run_command<T>(
        &self,
        body: impl FnOnce(&Connection) -> Result<T, DbError>,
    ) -> Result<T, DbError> {
        match &mut *self.lock() {
            DbState::Ready(conn) => db::run_with_time_limit(conn, db::COMMAND_TIME_LIMIT, body),
            DbState::Failed(reason) => {
                Err(DbError::new(DbErrorCode::MigrationFailed, reason.clone()))
            }
        }
    }
}

/// The files of the app under `base_dir` (section 5). `setup` passes the app data folder.
/// The self-test passes a new temp folder.
fn data_paths(base_dir: &Path) -> DataPaths {
    let data_dir = base_dir.join("data");
    DataPaths {
        db_file: data_dir.join("app.db"),
        data_dir,
        backups_dir: base_dir.join("backups"),
    }
}

/// Opens the database file, runs the migration runner (section 5, steps 1 to 10), and
/// then installs the authorizer. Answers `Failed` instead of an error, so the app still
/// starts and the update check still runs.
pub(crate) fn open_app_database(paths: &DataPaths, app_version: &str) -> DbState {
    match try_open_app_database(paths, db::EMBEDDED_MIGRATIONS, app_version) {
        Ok(conn) => DbState::Ready(conn),
        Err(reason) => DbState::Failed(reason),
    }
}

// The start path of the database. The app passes `db::EMBEDDED_MIGRATIONS`. The tests of
// the self-test pass their own files.
fn try_open_app_database(
    paths: &DataPaths,
    migrations: &[db::Migration],
    app_version: &str,
) -> Result<Connection, String> {
    fs::create_dir_all(&paths.data_dir)
        .map_err(|error| format!("The data folder could not be created: {error}"))?;
    let mut conn = db::open_database(&paths.db_file)
        .map_err(|error| format!("The database did not open: {error}"))?;
    db::run_migrations(&conn, migrations, app_version, |conn| {
        backup::write_backup(
            conn,
            &paths.backups_dir,
            backup::BackupKind::BeforeMigration(app_version),
        )
        .map(drop)
    })?;
    db::install_authorizer(&mut conn)
        .map_err(|error| format!("The statement rules could not be installed: {error}"))?;
    Ok(conn)
}

// Runs a command body when no other command runs, on a blocking thread. A sync command body
// would block an async worker for as long as it waits or runs. The update check and download
// need those workers, and SQLite cannot stop one long function call, for example a LIKE.
async fn run_queued_command<T: Send + 'static>(
    app: AppHandle,
    body: impl FnOnce(&Connection) -> Result<T, DbError> + Send + 'static,
) -> Result<T, DbError> {
    let database = app.state::<AppDatabase>();
    let _turn = database.command_turn.lock().await;
    let worker_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        worker_app.state::<AppDatabase>().run_command(body)
    })
    .await
    // Only a panic of the body or the end of the runtime gets here. No code fits better.
    .map_err(|error| {
        DbError::new(
            DbErrorCode::SqlError,
            format!("The database call stopped: {error}"),
        )
    })?
}

// The 4 commands of section 4. They are `async`, so they never run on the main thread and
// never freeze the window.

#[tauri::command]
async fn db_select(
    app: AppHandle,
    sql: String,
    params: Option<Vec<serde_json::Value>>,
) -> Result<db::SelectAnswer, DbError> {
    run_queued_command(app, move |conn| {
        db::select(conn, &sql, params.as_deref().unwrap_or_default())
    })
    .await
}

#[tauri::command]
async fn db_execute(
    app: AppHandle,
    sql: String,
    params: Option<Vec<serde_json::Value>>,
) -> Result<db::ExecuteAnswer, DbError> {
    run_queued_command(app, move |conn| {
        db::execute(conn, &sql, params.as_deref().unwrap_or_default())
    })
    .await
}

#[tauri::command]
async fn db_batch(
    app: AppHandle,
    statements: Vec<db::BatchStatement>,
) -> Result<db::BatchAnswer, DbError> {
    run_queued_command(app, move |conn| db::batch(conn, &statements)).await
}

#[tauri::command]
async fn app_info(app: AppHandle) -> Result<db::AppInfo, DbError> {
    let version = app.package_info().version.to_string();
    let database = app.state::<AppDatabase>();
    let db_file = database.paths.db_file.clone();
    let backups_dir = database.paths.backups_dir.clone();
    run_queued_command(app, move |conn| {
        let last_backup_at = backup::last_backup_at(&backups_dir)
            .map_err(|message| DbError::new(DbErrorCode::SqlError, message))?;
        db::app_info(conn, &db_file, version, last_backup_at)
    })
    .await
}

/// Starts the desktop app. main.rs calls it. With the self-test flag, it exits with 0 or 1.
pub fn run() {
    // The self-test comes before every plugin. So it takes no single-instance lock, opens no
    // window, starts no update check, and uses no network.
    if std::env::args_os()
        .nth(1)
        .is_some_and(|argument| argument == SELF_TEST_FLAG)
    {
        std::process::exit(run_self_test());
    }
    tauri::Builder::default()
        // The first plugin. A second start of the exe only focuses the first window.
        // This makes sure that two processes never migrate one file.
        // On macOS the lock is a socket in the shared `/tmp`. Another local user can take the
        // path first; security.md lists it.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app)
        }))
        // Security (section 10): the default comparator installs only a newer version. A rollback
        // is a new release of the older code with a higher version. `requireSignedVersion` in
        // tauri.conf.json refuses a higher version with the url and signature of an older build.
        // Both together stop a changed `latest.json` from installing an older signed build.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            db_select, db_execute, db_batch, app_info
        ])
        .on_menu_event(on_menu_event)
        .setup(setup)
        .run(tauri::generate_context!())
        .expect("the desktop shell failed to start");
}

// The CI self-test (section 9). It never touches the app data folder: it works in a new temp
// folder and deletes it at the end. Prints one result line and answers the exit code.
fn run_self_test() -> i32 {
    // The process id and the time give a new folder name on each run.
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |time| time.as_nanos());
    let base_dir =
        std::env::temp_dir().join(format!("wandit-self-test-{}-{nanos}", std::process::id()));
    // `create_dir` fails on a folder that exists, so the test never runs on old data.
    let result = match fs::create_dir(&base_dir) {
        Ok(()) => {
            let result = self_test(&data_paths(&base_dir), db::EMBEDDED_MIGRATIONS);
            // A folder that stays does not change the result. CI runners are new for each job.
            if let Err(error) = fs::remove_dir_all(&base_dir) {
                eprintln!(
                    "wandit-self-test: the temp folder {} stays: {error}",
                    base_dir.display()
                );
            }
            result
        }
        Err(error) => Err(format!(
            "The temp folder {} could not be created: {error}",
            base_dir.display()
        )),
    };
    match result {
        Ok(count) => {
            println!("wandit-self-test: ok, {count} migrations");
            0
        }
        Err(reason) => {
            // Security: one line only. So no line of the user SQL starts with "::" and becomes
            // a command of the GitHub runner.
            println!(
                "wandit-self-test: failed: {}",
                reason.replace(['\r', '\n'], " ")
            );
            1
        }
    }
}

// Runs the start path of the app on a new database in `paths`: the runner, then the
// authorizer. A new database has every file pending, so the runner also checks each
// replacement group. The connection closes before the caller deletes the folder.
// Answers the count of migrations.
fn self_test(paths: &DataPaths, migrations: &[db::Migration]) -> Result<usize, String> {
    try_open_app_database(paths, migrations, SELF_TEST_APP_VERSION)?;
    Ok(migrations.len())
}

fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    let paths = data_paths(&app.path().app_local_data_dir()?);
    let app_version = app.package_info().version.to_string();
    // The runner ends before the window exists, so the webview never queries an
    // unmigrated file.
    let state = open_app_database(&paths, &app_version);
    let failure = match &state {
        DbState::Failed(reason) => Some(reason.clone()),
        DbState::Ready(_) => None,
    };
    app.manage(AppDatabase {
        paths,
        state: Mutex::new(state),
        command_turn: tauri::async_runtime::Mutex::new(()),
    });
    // Tauri ignores a window menu on macOS, so the menu goes on the app.
    #[cfg(target_os = "macos")]
    handle.set_menu(build_menu(&handle)?)?;
    #[cfg(target_os = "macos")]
    if let Err(error) = create_main_window(&handle) {
        // The app menu stays on macOS, and the update check below still runs. So a
        // fixed build reaches the user, and Quit works.
        message_dialog(
            &handle,
            "The app did not open",
            format!(
                "The app could not lock the network of its window on this macOS version. \
                 It stays closed until an update fixes it. Use Help > Check for updates.\n\n{error}"
            ),
            MessageDialogKind::Error,
        )
        .show(|_| {});
    }
    #[cfg(not(target_os = "macos"))]
    create_main_window(&handle)?;
    if let Some(reason) = failure {
        // `show` does not block, so it may run here on the main thread.
        message_dialog(
            &handle,
            "The data did not open",
            format!(
                "The app could not open or update its data. The step that failed changed no data.\n\n{reason}"
            ),
            MessageDialogKind::Error,
        )
        .show(|_| {});
    }
    // The check runs also after a failed start, so a fixed build or a rollback reaches the user.
    std::thread::spawn(move || check_for_updates(&handle, false));
    Ok(())
}

// Rust creates the window, so the navigation lock applies to it (section 3).
fn create_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let title = app.config().product_name.clone().unwrap_or_default();
    // Security: without a CSP in tauri.conf.json, no answer has one. Such a build must not start.
    let csp = app
        .config()
        .app
        .security
        .csp
        .as_ref()
        .ok_or("tauri.conf.json has no CSP")?;
    let csp = HeaderValue::from_str(&csp.to_string())?;
    let builder = WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App("index.html".into()))
        .title(title)
        // Logical pixels. The minimum keeps a sidebar and a table usable.
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 560.0)
        .on_navigation(is_app_origin)
        // `window.open` and `target="_blank"` never open a window.
        .on_new_window(|_url, _features| NewWindowResponse::Deny)
        // Tauri calls this for each answer of the app protocol, after it builds the answer.
        .on_web_resource_request(move |_request, response| {
            add_missing_csp(response.headers_mut(), &csp)
        })
        // The app has no file download. WebView2 and WKWebView would write the file to
        // Downloads, with a name that the page chooses.
        .on_download(|_webview, _event| false);
    // macOS shows the app menu that `setup` sets, and ignores a window menu.
    #[cfg(not(target_os = "macos"))]
    let builder = builder.menu(build_menu(app)?);
    #[cfg(windows)]
    let builder = builder.additional_browser_args(WEBVIEW2_BROWSER_ARGS);
    #[cfg(target_os = "macos")]
    let builder = builder
        .with_webview_configuration(locked_webview_configuration()?)
        .proxy_url(Url::parse(LOOPBACK_PROXY_URL)?);
    builder.build()?;
    Ok(())
}

/// The WebKit configuration of the main window on macOS (docs/v2/desktop-apps.md, section 3).
/// WKWebView takes no browser args, and the CSP does not stop WebRTC UDP. So this sets the
/// private WKPreferences key `peerConnectionEnabled` to false before the first page script.
/// Answers an error when the key is missing or does not read back false: the window then
/// does not open (fail closed).
#[cfg(target_os = "macos")]
fn locked_webview_configuration(
) -> Result<objc2::rc::Retained<objc2_web_kit::WKWebViewConfiguration>, String> {
    use objc2::{runtime::NSObjectProtocol, sel, MainThreadMarker};
    use objc2_foundation::{ns_string, NSNumber, NSObjectNSKeyValueCoding};
    use objc2_web_kit::WKWebViewConfiguration;

    // Tauri calls `setup` on the main thread, and WebKit objects work only there.
    let main_thread =
        MainThreadMarker::new().ok_or("The window configuration needs the main thread.")?;
    // SAFETY: `main_thread` proves that this runs on the main thread, which WebKit requires.
    let config = unsafe { WKWebViewConfiguration::new(main_thread) };
    // SAFETY: the getter has no argument. A new configuration always holds a preferences object.
    let preferences = unsafe { config.preferences() };
    // Security: KVC on a key with no accessor raises an Objective-C exception, and the process
    // aborts. So both accessors must exist before the write.
    let has_peer_connection_key = preferences.respondsToSelector(sel!(_setPeerConnectionEnabled:))
        && preferences.respondsToSelector(sel!(_peerConnectionEnabled));
    if !has_peer_connection_key {
        return Err("This WebKit has no peerConnectionEnabled preference.".into());
    }
    let disabled = NSNumber::new_bool(false);
    // SAFETY: the check above found the setter. It takes a BOOL, which KVC reads from the NSNumber.
    unsafe { preferences.setValue_forKey(Some(&disabled), ns_string!("peerConnectionEnabled")) };
    let is_disabled = preferences
        .valueForKey(ns_string!("peerConnectionEnabled"))
        .and_then(|value| value.downcast::<NSNumber>().ok())
        .is_some_and(|value| !value.as_bool());
    if !is_disabled {
        return Err("WebKit did not turn off peerConnectionEnabled.".into());
    }
    // D-6: Newer WebKit makes this setter a no-op. An older WebKit (macOS 15) can still use it.
    // A missing setter is not an error, so the app still opens.
    if preferences.respondsToSelector(sel!(_setDNSPrefetchingEnabled:)) {
        // SAFETY: the check above found the setter. It takes a BOOL, which KVC reads from the
        // NSNumber.
        unsafe {
            preferences.setValue_forKey(Some(&disabled), ns_string!("DNSPrefetchingEnabled"))
        };
    }
    Ok(config)
}

/// Puts the CSP of tauri.conf.json on an answer of the app protocol that has none. Tauri sets
/// the CSP only on `.html` answers, so a worker script or an `.svg` page would run without one.
/// An `.html` answer keeps the CSP of Tauri, because it can hold the style nonces of the page.
fn add_missing_csp(headers: &mut HeaderMap, csp: &HeaderValue) {
    headers
        .entry(CONTENT_SECURITY_POLICY)
        .or_insert_with(|| csp.clone());
}

/// The navigation lock: true only for the origin of the bundled frontend on this system.
/// `http://tauri.localhost` on Windows, `tauri://localhost` on macOS and Linux. Tauri gives IPC
/// only to the origin of the current system, so the lock refuses the origin of the other system.
fn is_app_origin(url: &Url) -> bool {
    #[cfg(windows)]
    let (scheme, host) = ("http", "tauri.localhost");
    #[cfg(not(windows))]
    let (scheme, host) = ("tauri", "localhost");
    url.scheme() == scheme && url.host_str() == Some(host) && url.port().is_none()
}

// The native menu of section 3. Rust owns it, so the frontend cannot remove it.
#[cfg(not(target_os = "macos"))]
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let file = SubmenuBuilder::new(app, "File")
        .text(MENU_BACKUP, "Back up now")
        .text(MENU_EXPORT, "Export data...")
        .text(MENU_IMPORT, "Import data...")
        .separator()
        .text(MENU_QUIT, "Quit")
        .build()?;
    let help = SubmenuBuilder::new(app, "Help")
        .text(MENU_CHECK_UPDATES, "Check for updates")
        .text(MENU_ABOUT, "About")
        .build()?;
    MenuBuilder::new(app).items(&[&file, &help]).build()
}

// The first submenu is the app menu on macOS. Edit gives the copy and paste keys to the webview.
// The predefined Quit gives Cmd+Q, so this menu has no `MENU_QUIT` item.
#[cfg(target_os = "macos")]
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let product = app.config().product_name.clone().unwrap_or_default();
    let app_menu = SubmenuBuilder::new(app, &product)
        .text(MENU_ABOUT, format!("About {product}"))
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let file = SubmenuBuilder::new(app, "File")
        .text(MENU_BACKUP, "Back up now")
        .text(MENU_EXPORT, "Export data...")
        .text(MENU_IMPORT, "Import data...")
        .build()?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;
    let help = SubmenuBuilder::new(app, "Help")
        .text(MENU_CHECK_UPDATES, "Check for updates")
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &window, &help])
        .build()
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    let action: fn(&AppHandle) = match event.id().as_ref() {
        MENU_QUIT => {
            app.exit(0);
            return;
        }
        MENU_BACKUP => backup::back_up_now,
        MENU_EXPORT => backup::export_data,
        MENU_IMPORT => backup::import_data,
        MENU_CHECK_UPDATES => |app| check_for_updates(app, true),
        MENU_ABOUT => show_about,
        _ => return,
    };
    let app = app.clone();
    // The actions show blocking dialogs, and menu events arrive on the main thread.
    std::thread::spawn(move || action(&app));
}

fn focus_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    // After Cmd+H on macOS, set_focus does nothing. show() unhides the app first.
    // A failed focus leaves the window where it is. The second process ends anyway.
    if let Err(error) = window
        .unminimize()
        .and_then(|()| window.show())
        .and_then(|()| window.set_focus())
    {
        eprintln!("The main window did not get the focus: {error}");
    }
}

fn show_about(app: &AppHandle) {
    let product = app.config().product_name.clone().unwrap_or_default();
    let version = &app.package_info().version;
    show_message(
        app,
        "About",
        format!("{product}\nVersion {version}"),
        MessageDialogKind::Info,
    );
}

/// A native message dialog over the main window.
pub(crate) fn message_dialog(
    app: &AppHandle,
    title: &str,
    text: impl Into<String>,
    kind: MessageDialogKind,
) -> MessageDialogBuilder<Wry> {
    let dialog = app.dialog().message(text).title(title).kind(kind);
    match app.get_webview_window(MAIN_WINDOW) {
        Some(window) => dialog.parent(&window),
        None => dialog,
    }
}

/// Shows a message and waits for OK. Call it only from a worker thread.
pub(crate) fn show_message(
    app: &AppHandle,
    title: &str,
    text: impl Into<String>,
    kind: MessageDialogKind,
) {
    message_dialog(app, title, text, kind).blocking_show();
}

/// The update flow of section 10. `from_menu` is true for Help > Check for updates.
/// Then a check error and "no update" show a dialog. The check at start is silent on them.
/// An error after "Install" always shows a dialog.
/// Runs on a worker thread, because it waits for the network and for dialogs.
fn check_for_updates(app: &AppHandle, from_menu: bool) {
    if UPDATE_FLOW_RUNNING.swap(true, Ordering::SeqCst) {
        if from_menu {
            show_message(
                app,
                "Check for updates",
                "An update check is already running.",
                MessageDialogKind::Info,
            );
        }
        return;
    }
    let result = run_update_flow(app, from_menu);
    UPDATE_FLOW_RUNNING.store(false, Ordering::SeqCst);
    match result {
        Ok(()) => {}
        Err(message) if from_menu => {
            show_message(app, "Update failed", message, MessageDialogKind::Error)
        }
        // The check at start must not interrupt the user, for example when the PC is offline.
        Err(message) => eprintln!("Update check at start: {message}"),
    }
}

fn run_update_flow(app: &AppHandle, from_menu: bool) -> Result<(), String> {
    let updater = app
        .updater()
        .map_err(|error| format!("The updater is not configured: {error}"))?;
    let found = tauri::async_runtime::block_on(updater.check())
        .map_err(|error| format!("The update check failed: {error}"))?;
    let Some(update) = found else {
        if from_menu {
            let version = &app.package_info().version;
            show_message(
                app,
                "Check for updates",
                format!("Version {version} is the newest version."),
                MessageDialogKind::Info,
            );
        }
        return Ok(());
    };
    let notes = update
        .body
        .as_deref()
        .map(str::trim)
        .filter(|notes| !notes.is_empty())
        .unwrap_or("No release notes.");
    let install = message_dialog(
        app,
        "Update available",
        format!(
            "Version {} is available. You have version {}.\n\n{notes}",
            update.version, update.current_version
        ),
        MessageDialogKind::Info,
    )
    .buttons(MessageDialogButtons::OkCancelCustom(
        "Install".into(),
        "Later".into(),
    ))
    .blocking_show();
    if !install {
        return Ok(());
    }
    // The plugin checks the signature with the public key of this installer before it installs.
    // On Windows, the call starts the NSIS installer and then ends the app with `process::exit`.
    // The installer then starts the new version (`/R`).
    let database = app.state::<AppDatabase>();
    let installed = backup_before_update(&database, &update.current_version).and_then(|()| {
        tauri::async_runtime::block_on(update.download_and_install(|_, _| {}, || {}))
            .map_err(|error| format!("The update did not install: {error}{INSTALL_FAILED_HINT}"))
    });
    if let Err(message) = installed {
        // The user chose "Install", so the error shows a dialog, also after the check at start.
        show_message(app, "Update failed", message, MessageDialogKind::Error);
        return Ok(());
    }
    // Only macOS and Linux reach this restart.
    app.restart()
}

// Writes `before-update-<from version>-<UTC time>.db` (section 5). A failed backup stops the update.
// Security: a webview command can hold the lock for minutes, because SQLite cannot stop one long
// function call. So the copy first uses its own read-only connection and does not wait for the lock.
// WAL gives that connection the last commit. When that copy fails, the copy under the lock follows.
// A file that does not open then still gets a copy of its bytes, so a fixed build still installs.
fn backup_before_update(database: &AppDatabase, from_version: &str) -> Result<(), String> {
    let paths = &database.paths;
    let kind = || backup::BackupKind::BeforeUpdate(from_version);
    let written = db::open_read_only(&paths.db_file)
        .map_err(|error| format!("The database did not open: {error}"))
        .and_then(|conn| backup::write_backup(&conn, &paths.backups_dir, kind()).map(drop))
        .or_else(|error| {
            eprintln!("Update backup through its own connection: {error}");
            match &*database.lock() {
                DbState::Ready(conn) => {
                    backup::write_backup(conn, &paths.backups_dir, kind()).map(drop)
                }
                DbState::Failed(_) => {
                    backup::copy_closed_database(&paths.db_file, &paths.backups_dir, kind())
                }
            }
        });
    written.map_err(|error| {
        format!("The backup before the update failed, so the update did not start. {error}")
    })
}

#[cfg(test)]
pub(crate) mod test_support {
    use crate::db::Migration;
    use sha2::{Digest, Sha256};
    use std::{
        path::PathBuf,
        sync::atomic::{AtomicUsize, Ordering},
    };

    static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

    /// A migration with the SHA-256 that build.rs would write for `sql`.
    pub fn migration(version: i64, name: &'static str, sql: &'static str) -> Migration {
        let sha256: String = Sha256::digest(sql.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        // The tests run once per process, so the leaked strings stay small.
        Migration {
            version,
            name,
            sql,
            sha256: Box::leak(sha256.into_boxed_str()),
        }
    }

    /// A new empty folder under the system temp folder. The test deletes it at the end.
    pub fn test_dir(label: &str) -> PathBuf {
        let index = NEXT_DIR.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "wandit-shell-{label}-{}-{index}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}

#[cfg(test)]
mod tests {
    use super::{
        add_missing_csp, backup_before_update, data_paths, is_app_origin, open_app_database,
        self_test, try_open_app_database, AppDatabase, DataPaths, DbState,
    };
    use crate::{
        db,
        test_support::{migration, test_dir},
    };
    use std::{fs, path::PathBuf, sync::mpsc, sync::Mutex, time::Duration};
    use tauri::{
        http::{header::CONTENT_SECURITY_POLICY, HeaderMap, HeaderValue},
        Url,
    };

    fn app_database(paths: DataPaths, state: DbState) -> AppDatabase {
        AppDatabase {
            paths,
            state: Mutex::new(state),
            command_turn: tauri::async_runtime::Mutex::new(()),
        }
    }

    // The one file in the backups folder.
    fn only_backup(database: &AppDatabase) -> PathBuf {
        let files: Vec<PathBuf> = fs::read_dir(&database.paths.backups_dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .collect();
        assert_eq!(files.len(), 1, "{files:?}");
        files[0].clone()
    }

    // A stuck webview command holds the lock, for example one long LIKE. Install must still work.
    #[test]
    fn update_backup_does_not_wait_for_a_command_that_holds_the_lock() {
        let dir = test_dir("update-backup");
        let paths = data_paths(&dir);
        let notes = [migration(1, "init", "CREATE TABLE notes (body TEXT);")];
        let conn = try_open_app_database(&paths, &notes, "1.0.1").unwrap();
        conn.execute("INSERT INTO notes (body) VALUES ('saved')", [])
            .unwrap();
        let database = app_database(paths, DbState::Ready(conn));

        let held = database.lock();
        let (sender, receiver) = mpsc::channel();
        let result = std::thread::scope(|scope| {
            scope.spawn(|| sender.send(backup_before_update(&database, "1.0.1")));
            let result = receiver.recv_timeout(Duration::from_secs(2));
            // Code that waits for the lock continues now, so the scope ends and the test fails.
            drop(held);
            result
        });
        assert_eq!(result, Ok(Ok(())));
        let body: String = db::open_read_only(&only_backup(&database))
            .unwrap()
            .query_row("SELECT body FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(body, "saved");
        drop(database);
        fs::remove_dir_all(&dir).unwrap();
    }

    // A fixed build must reach an app whose file does not open. A copy through a connection
    // fails on that file, so the bytes are the backup.
    #[test]
    fn update_backup_copies_the_bytes_of_a_file_that_does_not_open() {
        let dir = test_dir("update-backup-damaged");
        let paths = data_paths(&dir);
        fs::create_dir_all(&paths.data_dir).unwrap();
        let damaged = [b'x'; 4096];
        fs::write(&paths.db_file, damaged).unwrap();
        let state = open_app_database(&paths, "1.0.1");
        assert!(matches!(state, DbState::Failed(_)));
        let database = app_database(paths, state);

        assert_eq!(backup_before_update(&database, "1.0.1"), Ok(()));
        assert_eq!(fs::read(only_backup(&database)).unwrap(), damaged);
        drop(database);
        fs::remove_dir_all(&dir).unwrap();
    }

    // The runner must run before the authorizer: the authorizer refuses the ledger writes.
    #[test]
    fn self_test_passes_good_files_on_a_new_database() {
        let migrations = [
            migration(
                1,
                "init",
                "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);",
            ),
            migration(2, "check", "SELECT (SELECT count(*) FROM notes) = 0;"),
        ];
        let dir = test_dir("self-test");
        assert_eq!(self_test(&data_paths(&dir), &migrations), Ok(2));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn navigation_lock_allows_only_the_app_origin() {
        // Each system accepts only its own app origin.
        let cases = [
            ("tauri://localhost/index.html", !cfg!(windows)),
            ("http://tauri.localhost/", cfg!(windows)),
            ("http://tauri.localhost/orders?id=3#top", cfg!(windows)),
            ("https://tauri.localhost/", false),
            ("http://tauri.localhost:8080/", false),
            ("http://tauri.localhost.example.com/", false),
            ("http://localhost:5173/", false),
            ("tauri://evil/index.html", false),
            ("https://example.com/", false),
            ("file:///C:/Windows/win.ini", false),
            ("javascript:alert(1)", false),
            ("about:blank", false),
        ];
        for (url, allowed) in cases {
            assert_eq!(is_app_origin(&Url::parse(url).unwrap()), allowed, "{url}");
        }
    }

    // A worker script has no CSP from Tauri. An `.html` answer must keep its nonces.
    #[test]
    fn every_answer_gets_a_csp_and_html_keeps_the_csp_of_tauri() {
        let csp = HeaderValue::from_static("default-src 'self'");
        let mut script = HeaderMap::new();
        add_missing_csp(&mut script, &csp);
        assert_eq!(script.get(CONTENT_SECURITY_POLICY), Some(&csp));

        let tauri_csp = HeaderValue::from_static("default-src 'self'; style-src 'nonce-1'");
        let mut html = HeaderMap::new();
        html.insert(CONTENT_SECURITY_POLICY, tauri_csp.clone());
        add_missing_csp(&mut html, &csp);
        let values: Vec<_> = html.get_all(CONTENT_SECURITY_POLICY).iter().collect();
        assert_eq!(values, [&tauri_csp]);
    }
}
