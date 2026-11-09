//! Backups, export, and import of the app database (docs/v2/desktop-apps.md, section 5).
//! lib.rs calls these from the File menu, the updater, and the migration runner.
//! A copy uses the SQLite online backup API, so it is consistent while the app runs.
//! Every dialog is a Rust call to tauri-plugin-dialog: the webview never gives a path.

use crate::db::{self, Migration};
use crate::{message_dialog, show_message, AppDatabase, DataPaths, DbState, MAIN_WINDOW};
use rusqlite::{
    backup::{Backup, StepResult},
    Connection, OptionalExtension,
};
use std::{
    fs::{self, File},
    io::{self, Read},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath, MessageDialogButtons, MessageDialogKind};

/// The shell keeps this many automatic backups. It never deletes a manual backup.
const KEEP_AUTOMATIC_BACKUPS: usize = 10;
/// Name prefix of every automatic backup. Retention deletes only files with this prefix.
const AUTOMATIC_PREFIX: &str = "before-";
const MANUAL_PREFIX: &str = "manual-";
/// The first 16 bytes of every SQLite database file.
const SQLITE_HEADER: &[u8; 16] = b"SQLite format 3\0";

/// Why the shell writes a backup. The kind decides the file name.
pub enum BackupKind<'a> {
    /// Step 7 of the migration runner. Holds the version of the app that migrates.
    BeforeMigration(&'a str),
    /// Before an update install. Holds the installed version.
    BeforeUpdate(&'a str),
    BeforeImport,
    /// File > Back up now.
    Manual,
}

fn backup_file_name(kind: &BackupKind<'_>, stamp: &str) -> String {
    match kind {
        BackupKind::BeforeMigration(version) => format!("{AUTOMATIC_PREFIX}{version}-{stamp}.db"),
        BackupKind::BeforeUpdate(version) => {
            format!("{AUTOMATIC_PREFIX}update-{version}-{stamp}.db")
        }
        BackupKind::BeforeImport => format!("{AUTOMATIC_PREFIX}import-{stamp}.db"),
        BackupKind::Manual => format!("{MANUAL_PREFIX}{stamp}.db"),
    }
}

// UTC time for a file name, for example `20261104T153012345Z`. It has milliseconds and no `:`,
// because Windows refuses `:` in a name. The fixed width makes text order equal to time order.
// SQLite formats it, so the shell needs no date crate.
fn utc_stamp() -> Result<String, String> {
    Connection::open_in_memory()
        .and_then(|conn| {
            conn.query_row(
                "SELECT replace(strftime('%Y%m%dT%H%M%f', 'now'), '.', '') || 'Z'",
                [],
                |row| row.get(0),
            )
        })
        .map_err(|error| format!("The time could not be read: {error}"))
}

// Reads the UTC time at the end of a backup file name. Answers None for a file that the
// shell did not write, so retention never deletes it.
fn backup_stamp(file_name: &str) -> Option<&str> {
    let (_, stamp) = file_name.strip_suffix(".db")?.rsplit_once('-')?;
    let bytes = stamp.as_bytes();
    let is_stamp = bytes.len() == 19
        && bytes[8] == b'T'
        && bytes[18] == b'Z'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 8 || index == 18 || byte.is_ascii_digit());
    is_stamp.then_some(stamp)
}

/// Writes a full copy of the open database to the backups folder and answers its path.
/// After an automatic backup, it deletes the automatic backups beyond the 10 newest.
pub fn write_backup(
    conn: &Connection,
    backups_dir: &Path,
    kind: BackupKind<'_>,
) -> Result<PathBuf, String> {
    fs::create_dir_all(backups_dir)
        .map_err(|error| format!("The backup folder could not be created: {error}"))?;
    let path = backups_dir.join(backup_file_name(&kind, &utc_stamp()?));
    copy_database(conn, &path)?;
    if !matches!(kind, BackupKind::Manual) {
        prune_after_backup(backups_dir);
    }
    Ok(path)
}

// Copies the main database of `conn` into a new file with the online backup API.
// One step (-1) copies all pages from one snapshot. With more steps, a write of another
// connection between two steps restarts the copy. The update backup has its own connection.
fn copy_database(conn: &Connection, destination: &Path) -> Result<(), String> {
    Connection::open(destination)
        .and_then(|mut target| Backup::new(conn, &mut target)?.step(-1))
        .map_err(|error| error.to_string())
        .and_then(|step| match step {
            StepResult::Done => Ok(()),
            // Busy or Locked: SQLite could not get the read lock in the busy timeout.
            other => Err(format!("the database is locked ({other:?})")),
        })
        .map_err(|error| {
            // A partial copy is not a backup.
            match remove_file_if_exists(destination) {
                Ok(()) => format!("The copy failed: {error}"),
                Err(remove_error) => format!("The copy failed: {error} {remove_error}"),
            }
        })
}

// A failed cleanup keeps extra files. It never fails the backup that just succeeded.
fn prune_after_backup(backups_dir: &Path) {
    if let Err(message) = prune_automatic_backups(backups_dir) {
        eprintln!("Backup cleanup: {message}");
    }
}

// Retention of section 5: keeps the 10 newest automatic backups. Manual backups and
// files that the shell did not write stay.
fn prune_automatic_backups(backups_dir: &Path) -> Result<(), String> {
    let mut automatic = Vec::new();
    for entry in fs::read_dir(backups_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        // A name that is not UTF-8 is not a file of the shell.
        let Ok(name) = entry.file_name().into_string() else {
            continue;
        };
        if let Some(stamp) = backup_stamp(&name).filter(|_| name.starts_with(AUTOMATIC_PREFIX)) {
            automatic.push((stamp.to_owned(), entry.path()));
        }
    }
    // Newest first.
    automatic.sort_by(|left, right| right.0.cmp(&left.0));
    for (_, path) in automatic.iter().skip(KEEP_AUTOMATIC_BACKUPS) {
        remove_file_if_exists(path)?;
        remove_file_if_exists(&db::sidecar_path(path, "-wal"))?;
    }
    Ok(())
}

/// UTC time of the newest backup, ISO 8601, for `app_info.lastBackupAt`. None when the
/// folder has no backup yet.
pub fn last_backup_at(backups_dir: &Path) -> Result<Option<String>, String> {
    let entries = match fs::read_dir(backups_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("The backup folder is not readable: {error}")),
    };
    let mut newest: Option<String> = None;
    for entry in entries {
        let entry = entry.map_err(|error| format!("The backup folder is not readable: {error}"))?;
        let Ok(name) = entry.file_name().into_string() else {
            continue;
        };
        let is_backup = name.starts_with(AUTOMATIC_PREFIX) || name.starts_with(MANUAL_PREFIX);
        if let Some(stamp) = backup_stamp(&name).filter(|_| is_backup) {
            if newest.as_deref().is_none_or(|current| stamp > current) {
                newest = Some(stamp.to_owned());
            }
        }
    }
    // `backup_stamp` checked 19 ASCII characters, so these byte ranges are valid.
    Ok(newest.map(|stamp| {
        format!(
            "{}-{}-{}T{}:{}:{}.{}Z",
            &stamp[0..4],
            &stamp[4..6],
            &stamp[6..8],
            &stamp[9..11],
            &stamp[11..13],
            &stamp[13..15],
            &stamp[15..18]
        )
    }))
}

// Deletes a file. A missing file is not an error.
fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("{} could not be deleted: {error}", path.display())),
    }
}

/// File > Back up now. Runs on a worker thread, because it shows blocking dialogs.
pub fn back_up_now(app: &AppHandle) {
    let database = app.state::<AppDatabase>();
    let result = database.with_connection(|conn| {
        write_backup(conn, &database.paths.backups_dir, BackupKind::Manual)
    });
    match result {
        Ok(path) => show_message(
            app,
            "Back up now",
            format!("The backup is saved:\n{}", path.display()),
            MessageDialogKind::Info,
        ),
        Err(message) => show_message(app, "Backup failed", message, MessageDialogKind::Error),
    }
}

/// File > Export data...: a Save dialog, then the online backup API to that path.
/// Runs on a worker thread.
pub fn export_data(app: &AppHandle) {
    let product = app.config().product_name.clone().unwrap_or_default();
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Export data")
        .set_file_name(format!("{product} data.db"))
        .add_filter("Database", &["db"]);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        dialog = dialog.set_parent(&window);
    }
    // None: the user closed the dialog.
    let Some(choice) = dialog.blocking_save_file() else {
        return;
    };
    let database = app.state::<AppDatabase>();
    let result = choice
        .into_path()
        .map_err(|error| format!("The path is not valid: {error}"))
        .and_then(|path| {
            // The Save dialog already asked to replace an old file.
            // The backup API cannot write over a file that is not an SQLite database.
            remove_file_if_exists(&path)?;
            database
                .with_connection(|conn| copy_database(conn, &path))
                .map(|()| path)
        });
    match result {
        Ok(path) => show_message(
            app,
            "Export data",
            format!("The data is saved:\n{}", path.display()),
            MessageDialogKind::Info,
        ),
        Err(message) => show_message(app, "Export failed", message, MessageDialogKind::Error),
    }
}

/// File > Import data... (section 5). It shows an Open dialog, checks the file, and asks to confirm.
/// Then it writes a backup, swaps the file with one rename, and runs the runner.
/// Runs on a worker thread.
pub fn import_data(app: &AppHandle) {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Import data")
        .add_filter("Database", &["db"]);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        dialog = dialog.set_parent(&window);
    }
    let Some(choice) = dialog.blocking_pick_file() else {
        return;
    };
    let database = app.state::<AppDatabase>();
    let staged = match stage_import(choice, &database.paths) {
        Ok(staged) => staged,
        Err(message) => {
            show_message(
                app,
                "Import refused",
                format!("This file cannot be imported. Your data is unchanged.\n\n{message}"),
                MessageDialogKind::Error,
            );
            return;
        }
    };
    let confirmed = message_dialog(
        app,
        "Import data",
        "The import replaces all data of this app with the data of the file. The app writes a backup of the current data first.",
        MessageDialogKind::Warning,
    )
    .buttons(MessageDialogButtons::OkCancelCustom("Import".into(), "Cancel".into()))
    .blocking_show();
    if !confirmed {
        // A left-over copy only takes disk space. The user canceled, so no dialog.
        if let Err(message) = remove_file_if_exists(&staged) {
            eprintln!("Import cleanup: {message}");
        }
        return;
    }
    let app_version = app.package_info().version.to_string();
    let result = replace_database(&database, &app_version, &staged);
    // After a swap the staged file is gone. After a failure it is still there.
    let cleanup = remove_file_if_exists(&staged);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        // The frontend reads the new data, or shows the `migration_failed` screen.
        if let Err(error) = window.reload() {
            eprintln!("The window did not reload after the import: {error}");
        }
    }
    match result.and(cleanup) {
        Ok(()) => show_message(
            app,
            "Import data",
            "The import is complete.",
            MessageDialogKind::Info,
        ),
        Err(message) => show_message(app, "Import failed", message, MessageDialogKind::Error),
    }
}

// Copies the chosen file into the data folder and checks the copy. The checked bytes are
// then the imported bytes, also when the original file changes after the check.
fn stage_import(choice: FilePath, paths: &DataPaths) -> Result<PathBuf, String> {
    let source = choice
        .into_path()
        .map_err(|error| format!("The path is not valid: {error}"))?;
    let staged = paths.data_dir.join(format!("import-{}.tmp", utc_stamp()?));
    let checked = fs::copy(&source, &staged)
        .map_err(|error| format!("The file could not be read: {error}"))
        .and_then(|_| check_import(&staged, db::EMBEDDED_MIGRATIONS));
    // A read-only open of a WAL-mode file can leave these two files next to the copy.
    let cleanup = remove_file_if_exists(&db::sidecar_path(&staged, "-wal"))
        .and(remove_file_if_exists(&db::sidecar_path(&staged, "-shm")));
    match checked.and(cleanup) {
        Ok(()) => Ok(staged),
        Err(message) => match remove_file_if_exists(&staged) {
            Ok(()) => Err(message),
            Err(remove_error) => Err(format!("{message} {remove_error}")),
        },
    }
}

/// One row of `sqlite_schema`. `rootpage` differs between files, so it is left out.
#[derive(Debug, PartialEq)]
struct SchemaRow {
    /// `table`, `index`, `view`, or `trigger`.
    kind: String,
    name: String,
    table: String,
    /// The CREATE text. Null for the automatic index of a UNIQUE constraint.
    sql: Option<String>,
}

fn read_schema(conn: &Connection) -> rusqlite::Result<Vec<SchemaRow>> {
    let mut statement =
        conn.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name")?;
    let rows = statement.query_map([], |row| {
        Ok(SchemaRow {
            kind: row.get(0)?,
            name: row.get(1)?,
            table: row.get(2)?,
            sql: row.get(3)?,
        })
    })?;
    rows.collect()
}

/// The import checks of section 5. `migrations` is sorted by version. Answers the reason
/// of a refusal. The file is untrusted, so the check opens it read-only with the safety settings.
/// It reads the ledger only after the schema shows that the ledger is a table, not a view.
/// The fresh run resolves each target to its newest replacement, as a new install does.
fn check_import(path: &Path, migrations: &[Migration]) -> Result<(), String> {
    let not_sqlite = "The file is not an SQLite database.";
    let mut header = [0u8; 16];
    File::open(path)
        .and_then(|mut file| file.read_exact(&mut header))
        .map_err(|_| not_sqlite.to_owned())?;
    if &header != SQLITE_HEADER {
        return Err(not_sqlite.to_owned());
    }
    let sqlite_error = |error: rusqlite::Error| format!("The file could not be read: {error}");
    let conn = db::open_read_only(path).map_err(sqlite_error)?;

    let integrity: Vec<String> = conn
        .prepare("PRAGMA integrity_check")
        .and_then(|mut statement| statement.query_map([], |row| row.get(0))?.collect())
        .map_err(sqlite_error)?;
    if integrity != ["ok"] {
        let first = integrity.first().map(String::as_str).unwrap_or("no answer");
        return Err(format!("The file is damaged: {first}"));
    }

    let ledger_kind: Option<String> = conn
        .query_row(
            "SELECT type FROM sqlite_schema WHERE name = 'wandit_migrations'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(sqlite_error)?;
    if ledger_kind.as_deref() != Some("table") {
        return Err("The file holds no data of a desktop app.".to_owned());
    }
    let applied = db::read_ledger(&conn).map_err(sqlite_error)?;
    for (version, sha256) in &applied {
        let matches = migrations
            .iter()
            .any(|migration| migration.version == *version && migration.sha256 == sha256);
        if !matches {
            return Err(format!(
                "Migration {version} of the file does not match this app."
            ));
        }
    }
    // Every ledger row matches an embedded file, so equal counts mean equal version sets.
    let highest = applied.last().map_or(0, |(version, _)| *version);
    let expected_count = migrations
        .iter()
        .filter(|migration| migration.version <= highest)
        .count();
    if expected_count != applied.len() {
        return Err("The file misses a migration of this app.".to_owned());
    }

    // Same `sqlite_schema` rows as a fresh database at the same version: no extra
    // table, column, index, view, or trigger.
    let fresh = Connection::open_in_memory().map_err(sqlite_error)?;
    db::apply_safety_settings(&fresh).map_err(sqlite_error)?;
    // A new install runs a replacement in place of its target, also above `highest`.
    // The gate proves that both make the same schema.
    let mut fresh_migrations = Vec::new();
    for migration in migrations {
        let position = db::replaced_version(migration)?.unwrap_or(migration.version);
        if position <= highest {
            fresh_migrations.push(*migration);
        }
    }
    // The ledger of `fresh` is empty, so the runner never asks for a backup.
    db::run_migrations(&fresh, &fresh_migrations, "import-check", |_| Ok(()))?;
    if read_schema(&conn).map_err(sqlite_error)? != read_schema(&fresh).map_err(sqlite_error)? {
        return Err(
            "The tables, views, indexes, or triggers of the file differ from this app.".to_owned(),
        );
    }
    Ok(())
}

// Puts the staged file in place of the app database. The steps are a backup, a clean close,
// an atomic rename, a reopen, and the runner. The function holds the lock for all steps,
// so no command runs on a half-swapped file.
fn replace_database(
    database: &AppDatabase,
    app_version: &str,
    staged: &Path,
) -> Result<(), String> {
    let paths = &database.paths;
    let mut state = database.lock();
    match &*state {
        DbState::Ready(conn) => {
            write_backup(conn, &paths.backups_dir, BackupKind::BeforeImport).map_err(|error| {
                format!("The backup before the import failed. Your data is unchanged. {error}")
            })?;
        }
        DbState::Failed(_) => {
            copy_closed_database(&paths.db_file, &paths.backups_dir, BackupKind::BeforeImport)
                .map_err(|error| {
                    format!("The backup before the import failed. Your data is unchanged. {error}")
                })?
        }
    }
    let previous = std::mem::replace(
        &mut *state,
        DbState::Failed("The import is in progress.".to_owned()),
    );
    if let DbState::Ready(conn) = previous {
        // Closing the last connection writes the WAL into the file and deletes the WAL.
        if let Err((conn, error)) = conn.close() {
            *state = DbState::Ready(conn);
            return Err(format!(
                "The database did not close. Your data is unchanged. {error}"
            ));
        }
    }
    let swap = clear_sidecars(&paths.db_file).and_then(|()| {
        fs::rename(staged, &paths.db_file).map_err(|error| {
            format!("The file could not be moved in place. Your data is unchanged. {error}")
        })
    });
    // After a failed swap this reopens the old file, which is still in place.
    *state = crate::open_app_database(paths, app_version);
    swap?;
    match &*state {
        DbState::Ready(_) => Ok(()),
        DbState::Failed(reason) => Err(format!(
            "The data of the file is in place, but it did not open. The backup before the import keeps the earlier data. {reason}"
        )),
    }
}

// A WAL file of the old database would be applied to the new file and damage it. The
// backup before the swap holds every committed row, also the rows still in the WAL.
fn clear_sidecars(db_file: &Path) -> Result<(), String> {
    remove_file_if_exists(&db::sidecar_path(db_file, "-wal"))?;
    remove_file_if_exists(&db::sidecar_path(db_file, "-shm"))
}

/// The automatic backup before an import or an update in the `Failed` state.
/// No connection is open in that state. A plain copy of the file and of its WAL file is then complete.
pub fn copy_closed_database(
    db_file: &Path,
    backups_dir: &Path,
    kind: BackupKind<'_>,
) -> Result<(), String> {
    let exists = db_file
        .try_exists()
        .map_err(|error| format!("The database file is not readable: {error}"))?;
    // No file yet: nothing to keep.
    if !exists {
        return Ok(());
    }
    fs::create_dir_all(backups_dir)
        .map_err(|error| format!("The backup folder could not be created: {error}"))?;
    let target = backups_dir.join(backup_file_name(&kind, &utc_stamp()?));
    fs::copy(db_file, &target).map_err(|error| format!("The copy failed: {error}"))?;
    let wal = db::sidecar_path(db_file, "-wal");
    let wal_exists = wal
        .try_exists()
        .map_err(|error| format!("The WAL file is not readable: {error}"))?;
    if wal_exists {
        fs::copy(&wal, db::sidecar_path(&target, "-wal"))
            .map_err(|error| format!("The copy of the WAL file failed: {error}"))?;
    }
    prune_after_backup(backups_dir);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{migration, test_dir};

    const NOTES: &str = "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL);";
    const TAGS: &str = "CREATE TABLE tags (name TEXT UNIQUE);";

    // An exported file of an app that ran `migrations`, as File > Export data writes it.
    fn exported_file(dir: &Path, migrations: &[Migration]) -> PathBuf {
        let conn = db::open_database(&dir.join("app.db")).unwrap();
        db::run_migrations(&conn, migrations, "1.0.1", |_| Ok(())).unwrap();
        conn.execute("INSERT INTO notes (body) VALUES ('saved')", [])
            .unwrap();
        let export = dir.join("export.db");
        copy_database(&conn, &export).unwrap();
        export
    }

    #[test]
    fn import_check_accepts_an_export_of_the_same_app() {
        let dir = test_dir("import-ok");
        let migrations = [migration(1, "init", NOTES), migration(2, "add_tags", TAGS)];
        let export = exported_file(&dir, &migrations);
        assert_eq!(check_import(&export, &migrations), Ok(()));
        // An export of an older build imports into a newer build; the runner migrates it after the swap.
        let older_dir = test_dir("import-older");
        let older = exported_file(&older_dir, &migrations[..1]);
        assert_eq!(check_import(&older, &migrations), Ok(()));
        fs::remove_dir_all(dir).unwrap();
        fs::remove_dir_all(older_dir).unwrap();
    }

    #[test]
    fn import_check_runs_the_replacement_for_a_backup_that_ran_the_replaced_file() {
        let dir = test_dir("import-replaced");
        let conn = db::open_database(&dir.join("app.db")).unwrap();
        let init = migration(1, "init", NOTES);
        db::run_migrations(&conn, &[init], "1.0.1", |_| Ok(())).unwrap();
        conn.execute("INSERT INTO notes (body) VALUES ('saved')", [])
            .unwrap();
        // File 2 works here because note 1 exists. It fails on a new install.
        let seed_pins = migration(
            2,
            "seed_pins",
            "CREATE TABLE pins (note_id INTEGER NOT NULL REFERENCES notes (id));\nINSERT OR IGNORE INTO pins VALUES (1);",
        );
        db::run_migrations(&conn, &[init, seed_pins], "1.0.2", |_| Ok(())).unwrap();
        let export = dir.join("export.db");
        copy_database(&conn, &export).unwrap();

        let seed_pins_fix = migration(
            3,
            "seed_pins_fix",
            "-- wandit:replaces 0002\nCREATE TABLE pins (note_id INTEGER NOT NULL REFERENCES notes (id));\nINSERT OR IGNORE INTO pins SELECT id FROM notes;",
        );
        assert_eq!(
            check_import(&export, &[init, seed_pins, seed_pins_fix]),
            Ok(())
        );
        drop(conn);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn import_check_refuses_an_extra_trigger() {
        let dir = test_dir("import-trigger");
        let migrations = [migration(1, "init", NOTES)];
        let export = exported_file(&dir, &migrations);
        let conn = Connection::open(&export).unwrap();
        conn.execute_batch(
            "CREATE TRIGGER wipe AFTER INSERT ON notes BEGIN DELETE FROM notes; END;",
        )
        .unwrap();
        drop(conn);
        let error = check_import(&export, &migrations).unwrap_err();
        assert!(error.contains("differ from this app"), "{error}");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn import_check_refuses_a_checksum_mismatch() {
        let dir = test_dir("import-checksum");
        let export = exported_file(&dir, &[migration(1, "init", NOTES)]);
        let other_text = [migration(
            1,
            "init",
            "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL, done INTEGER);",
        )];
        let error = check_import(&export, &other_text).unwrap_err();
        assert!(
            error.contains("Migration 1 of the file does not match"),
            "{error}"
        );
        fs::remove_dir_all(dir).unwrap();
    }

    // A database of the embedded migrations, marked with `user_version`. The mark is not
    // in `sqlite_schema`, so the import check ignores it.
    fn marked_database(path: &Path, mark: i64) {
        let conn = db::open_database(path).unwrap();
        db::run_migrations(&conn, db::EMBEDDED_MIGRATIONS, "1.0.1", |_| Ok(())).unwrap();
        conn.pragma_update(None, "user_version", mark).unwrap();
    }

    fn mark_of(path: &Path) -> i64 {
        let conn = db::open_read_only(path).unwrap();
        conn.pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn import_swap_replaces_the_data_and_keeps_a_backup() {
        let dir = test_dir("import-swap");
        let paths = DataPaths {
            data_dir: dir.join("data"),
            db_file: dir.join("data").join("app.db"),
            backups_dir: dir.join("backups"),
        };
        fs::create_dir_all(&paths.data_dir).unwrap();
        marked_database(&paths.db_file, 1);
        let staged = paths.data_dir.join("import.tmp");
        marked_database(&staged, 2);
        assert_eq!(check_import(&staged, db::EMBEDDED_MIGRATIONS), Ok(()));
        let database = AppDatabase {
            state: std::sync::Mutex::new(crate::open_app_database(&paths, "1.0.1")),
            paths,
            command_turn: tauri::async_runtime::Mutex::new(()),
        };

        assert_eq!(replace_database(&database, "1.0.1", &staged), Ok(()));
        assert!(matches!(&*database.lock(), DbState::Ready(_)));
        assert!(!staged.exists());
        assert_eq!(mark_of(&database.paths.db_file), 2);
        let backups: Vec<PathBuf> = fs::read_dir(&database.paths.backups_dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .collect();
        assert_eq!(backups.len(), 1);
        let backup_name = backups[0].file_name().unwrap().to_str().unwrap();
        assert!(backup_name.starts_with("before-import-"), "{backup_name}");
        assert_eq!(mark_of(&backups[0]), 1);
        drop(database);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn closed_copy_keeps_the_rows_that_are_still_in_the_wal_file() {
        let dir = test_dir("closed-copy");
        let db_file = dir.join("app.db");
        let conn = db::open_database(&db_file).unwrap();
        // No checkpoint: the writes stay in the WAL file, as after a crash of the app.
        conn.pragma_update(None, "wal_autocheckpoint", 0).unwrap();
        db::run_migrations(&conn, &[migration(1, "init", NOTES)], "1.0.1", |_| Ok(())).unwrap();
        conn.execute("INSERT INTO notes (body) VALUES ('saved')", [])
            .unwrap();
        let backups = dir.join("backups");
        copy_closed_database(&db_file, &backups, BackupKind::BeforeUpdate("1.0.1")).unwrap();
        drop(conn);

        let backup_file = fs::read_dir(&backups)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|path| path.extension().is_some_and(|extension| extension == "db"))
            .unwrap();
        let name = backup_file.file_name().unwrap().to_str().unwrap();
        assert!(name.starts_with("before-update-1.0.1-"), "{name}");
        let copy = db::open_database(&backup_file).unwrap();
        let body: String = copy
            .query_row("SELECT body FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(body, "saved");
        drop(copy);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn retention_keeps_10_automatic_backups_and_every_manual_backup() {
        let dir = test_dir("retention");
        let stamp = |minute: u32| format!("20261104T12{minute:02}00000Z");
        for minute in 0..12 {
            File::create(dir.join(backup_file_name(
                &BackupKind::BeforeMigration("1.0.1"),
                &stamp(minute),
            )))
            .unwrap();
        }
        File::create(dir.join(backup_file_name(&BackupKind::Manual, &stamp(0)))).unwrap();
        File::create(dir.join("before-notes.db")).unwrap();
        prune_automatic_backups(&dir).unwrap();

        let mut names: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        let mut expected: Vec<String> = (2..12)
            .map(|minute| format!("before-1.0.1-{}.db", stamp(minute)))
            .collect();
        expected.push("before-notes.db".to_owned());
        expected.push(format!("manual-{}.db", stamp(0)));
        expected.sort();
        assert_eq!(names, expected);
        assert_eq!(
            last_backup_at(&dir).unwrap().as_deref(),
            Some("2026-11-04T12:11:00.000Z")
        );
        fs::remove_dir_all(dir).unwrap();
    }
}
