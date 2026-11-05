//! Local SQLite database of a desktop app (docs/v2/desktop-apps.md, sections 4 and 5).
//! It opens the file with the safety settings and runs the migration runner.
//! It installs the statement authorizer, runs each command with a time limit, and holds the
//! bodies of the 4 webview commands.
//! lib.rs wraps these plain functions in Tauri commands. backup.rs uses the runner too.

use rusqlite::{
    config::DbConfig,
    fallible_iterator::FallibleIterator,
    hooks::{AuthAction, AuthContext, Authorization},
    limits::Limit,
    types::{Value, ValueRef},
    Batch, Connection, ErrorCode, OpenFlags, Statement,
};
use serde::{Deserialize, Serialize};
use std::{
    cell::Cell,
    collections::HashSet,
    ffi::c_int,
    fs, io,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

include!(concat!(env!("OUT_DIR"), "/migrations.rs"));

/// One SQL file of `migrations/`. build.rs writes the list `EMBEDDED_MIGRATIONS`.
/// Line 1 of `sql` can name a file that this file replaces. See `replaced_version`.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    /// The 4-digit version of the file name, as a number.
    pub version: i64,
    /// The name part of the file name, for example `add_customers`. The server registry uses the same value.
    pub name: &'static str,
    pub sql: &'static str,
    /// Lowercase hex SHA-256 of the exact file bytes. The ledger keeps it to detect a changed file.
    pub sha256: &'static str,
}

/// Largest `sql` text of one statement, in bytes.
const MAX_SQL_BYTES: usize = 100_000;
/// Most params of one statement.
const MAX_PARAMS: usize = 999;
/// Most statements of one `db_batch` call.
const MAX_BATCH_STATEMENTS: usize = 500;
/// Most rows of one `db_select` answer. A larger result needs LIMIT and OFFSET in the app.
const MAX_SELECT_ROWS: usize = 10_000;
/// `Number.MAX_SAFE_INTEGER` of JavaScript, 2^53 - 1. A larger integer loses precision in the webview.
const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;
/// Section 5 sets 5 s. A backup copy reads the file while a command waits.
const BUSY_TIMEOUT: Duration = Duration::from_millis(5000);
/// Time limit of one webview command, a whole `db_batch` included. A query of a desktop app
/// on its local file takes far less than 1 s, so 10 s leaves a large margin for a slow PC.
/// A loop that never ends, for example a recursive CTE over a cycle, then stops after 10 s.
/// One long function call can run longer (see `PROGRESS_STEPS`). The update backup first copies
/// through its own connection, without the database lock (lib.rs), so such a call does not stop
/// an update.
pub const COMMAND_TIME_LIMIT: Duration = Duration::from_secs(10);
/// SQLite calls the time check after about this many VM steps, and only between two steps.
/// One step can call a function, for example LIKE, instr, or replace on a long text. That
/// step can run for minutes, and SQLite cannot stop it. 1,000 short steps take far less than 1 ms.
const PROGRESS_STEPS: c_int = 1000;

/// The ledger of the migration runner (section 5). Never change this text.
/// The import check compares the `sqlite_schema` text of an exported file with a fresh database.
/// With a changed text, the check refuses every earlier export.
/// `LEDGER_SQL` in `src/lib/preview-db.ts` of the template holds the same text.
/// Each embedded version gets one row. `sha256` is always the hash of the file of that version.
/// Status `applied`: the SQL of this file ran.
/// Status `replaced`: this file is a target. Its newest replacement ran in its place.
/// Status `skipped`: this file is a replacement, and its SQL did not run.
const CREATE_LEDGER_SQL: &str = "CREATE TABLE IF NOT EXISTS wandit_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'replaced', 'skipped')),
  recorded_at TEXT NOT NULL,
  app_version TEXT NOT NULL
)";

/// Line 1 of a replacement starts with this text. Then come 4 ASCII digits and `\n`.
const REPLACES_PREFIX: &str = "-- wandit:replaces ";
/// A line that starts with this text is a header line. Only line 1 may hold one.
const MARKER_PREFIX: &str = "-- wandit:";
/// The longest part of a check text in an error, in characters.
const MAX_CHECK_TEXT_CHARS: usize = 200;
/// The longest part of a TEXT answer of a check in an error, in characters.
const MAX_SHOWN_TEXT_CHARS: usize = 50;

/// Error codes of section 4. `src/lib/db.ts` of the template reads them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DbErrorCode {
    /// The database did not open or migrate at start.
    MigrationFailed,
    /// The authorizer or the command refused the statement kind.
    StatementRefused,
    /// SQLite refused the statement. The message is the SQLite text.
    SqlError,
    TooManyRows,
    /// A BLOB value, a REAL that is not finite, or TEXT that is not UTF-8.
    UnsupportedValue,
    /// The call breaks a limit of section 4.
    InvalidInput,
}

/// A failed command. The webview receives `{ code, message }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DbError {
    pub code: DbErrorCode,
    pub message: String,
}

impl DbError {
    pub fn new(code: DbErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(error: rusqlite::Error) -> Self {
        match &error {
            rusqlite::Error::SqliteFailure(failure, _)
                if failure.code == ErrorCode::AuthorizationForStatementDenied =>
            {
                Self::new(
                    DbErrorCode::StatementRefused,
                    format!("{error}: the app may only read and write the rows of its own tables. A schema change needs a migration."),
                )
            }
            // Only the time check of `run_with_time_limit` interrupts a statement.
            rusqlite::Error::SqliteFailure(failure, _)
                if failure.code == ErrorCode::OperationInterrupted =>
            {
                Self::new(
                    DbErrorCode::SqlError,
                    format!(
                        "{error}: the call ran longer than {} s, so the shell stopped it. Make the query faster, for example with an index or a LIMIT.",
                        COMMAND_TIME_LIMIT.as_secs()
                    ),
                )
            }
            _ => Self::new(DbErrorCode::SqlError, error.to_string()),
        }
    }
}

/// One value of a result row. A REAL is always finite.
#[derive(Debug, PartialEq, Serialize)]
#[serde(untagged)]
pub enum SqlValue {
    Null,
    Integer(i64),
    Real(f64),
    Text(String),
}

/// Answer of `db_select`.
#[derive(Debug, PartialEq, Serialize)]
pub struct SelectAnswer {
    pub columns: Vec<String>,
    /// One array per row, in the order of `columns`.
    pub rows: Vec<Vec<SqlValue>>,
}

/// Answer of `db_execute`, and of each statement of `db_batch`.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteAnswer {
    /// Rows that the statement inserted, updated, or deleted. 0 for a read.
    pub changes: u64,
    /// `sqlite3_last_insert_rowid` of the connection after the statement.
    pub last_insert_row_id: i64,
}

/// Answer of `db_batch`.
#[derive(Debug, PartialEq, Serialize)]
pub struct BatchAnswer {
    pub results: Vec<ExecuteAnswer>,
}

/// One statement of a `db_batch` call, as the webview sends it.
#[derive(Debug, Deserialize)]
pub struct BatchStatement {
    pub sql: String,
    /// Positional params: each one is null, a boolean, a number, or a string.
    pub params: Option<Vec<serde_json::Value>>,
}

/// Answer of `app_info`.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    /// Semver of the installed app, from tauri.desktop.json.
    pub version: String,
    /// Highest version in the ledger. 0 before the first migration.
    pub schema_version: i64,
    /// Size of the database file plus its WAL file, in bytes.
    pub database_bytes: u64,
    /// UTC time of the newest backup, ISO 8601. Null before the first backup.
    pub last_backup_at: Option<String>,
}

/// Opens (or creates) the app database file with the settings of section 5.
pub fn open_database(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    apply_safety_settings(&conn)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(conn)
}

/// Opens a file read-only with the same safety settings. The import check and the backup
/// before an update use it.
pub fn open_read_only(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    apply_safety_settings(&conn)?;
    Ok(conn)
}

/// Settings of every connection of the shell. DEFENSIVE blocks writes to the schema tables.
/// The ATTACH limit of 0 blocks every other file, also the target of VACUUM INTO.
/// The migration gate of the server uses the same `foreign_keys` and `trusted_schema` values.
pub fn apply_safety_settings(conn: &Connection) -> rusqlite::Result<()> {
    conn.set_db_config(DbConfig::SQLITE_DBCONFIG_DEFENSIVE, true)?;
    conn.set_limit(Limit::SQLITE_LIMIT_ATTACHED, 0)?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.pragma_update(None, "trusted_schema", false)?;
    conn.busy_timeout(BUSY_TIMEOUT)
}

/// Path of a file that SQLite keeps next to the database, for example `app.db-wal`.
pub fn sidecar_path(db_file: &Path, suffix: &str) -> PathBuf {
    let mut path = db_file.as_os_str().to_owned();
    path.push(suffix);
    PathBuf::from(path)
}

/// Reads the ledger as (version, sha256) rows, sorted by version.
pub fn read_ledger(conn: &Connection) -> rusqlite::Result<Vec<(i64, String)>> {
    let mut statement =
        conn.prepare("SELECT version, sha256 FROM wandit_migrations ORDER BY version")?;
    let rows = statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    rows.collect()
}

/// The migration runner of section 5, steps 1 to 10. Call it before `install_authorizer`,
/// which refuses the ledger writes. `migrations` is sorted by version. `backup` writes the
/// backup of step 7, only when the ledger has rows and a file is pending.
/// All pending files run in one transaction. Answers the reason when the app must stay in
/// the `migration_failed` state. The database is then as before the call.
pub fn run_migrations(
    conn: &Connection,
    migrations: &[Migration],
    app_version: &str,
    backup: impl FnOnce(&Connection) -> Result<(), String>,
) -> Result<(), String> {
    conn.execute_batch(CREATE_LEDGER_SQL)
        .map_err(|error| format!("The ledger could not be created: {error}"))?;
    let applied =
        read_ledger(conn).map_err(|error| format!("The ledger could not be read: {error}"))?;

    // Step 3: installed apps ran this exact text. Another text means a wrong build.
    for (version, sha256) in &applied {
        if migrations
            .iter()
            .any(|migration| migration.version == *version && migration.sha256 != sha256)
        {
            return Err(format!(
                "Migration {version} of this build differs from the one that the database ran."
            ));
        }
    }

    let pending: Vec<&Migration> = migrations
        .iter()
        .filter(|migration| {
            !applied
                .iter()
                .any(|(version, _)| *version == migration.version)
        })
        .collect();
    // Step 4: a pending file below the database version is missing from an older build.
    // Ledger rows above every embedded version stay allowed: that is a rollback.
    if let Some((highest, _)) = applied.last() {
        if let Some(late) = pending
            .iter()
            .find(|migration| migration.version < *highest)
        {
            return Err(format!(
                "Migration {} is below version {highest} of the database.",
                late.version
            ));
        }
    }
    // Step 5: nothing to run, so the database does not change.
    if pending.is_empty() {
        return Ok(());
    }
    // Step 6, after step 5: a bad group must not lock out an install that has nothing to run.
    let targets = read_replacement_targets(migrations)?;
    // Step 7: never migrate saved data without a backup. An empty ledger has no saved data.
    if !applied.is_empty() {
        backup(conn).map_err(|error| format!("The backup before the migration failed: {error}"))?;
    }
    // Steps 8 to 10: one transaction for all pending files. A failure leaves the database
    // exactly as before the update.
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|error| format!("The migration transaction did not start: {error}"))?;
    apply_pending(conn, migrations, &targets, &pending, app_version)
        .and_then(|()| {
            conn.execute_batch("COMMIT")
                .map_err(|error| format!("The migrations did not commit: {error}"))
        })
        // A deferred foreign key fails at COMMIT, and SQLite then keeps the transaction open.
        .map_err(|message| rollback_with(conn, message))
}

// `0007_add_customers.sql`: the file name of a migration, for the error texts.
fn file_name(migration: &Migration) -> String {
    format!("{:04}_{}.sql", migration.version, migration.name)
}

/// Reads line 1 of a migration (section 5). Answers the target version of a replacement,
/// or None for a plain file. A bad "-- wandit:" line gives an error text.
/// The same rules as `parseDesktopMigrationHeader` of packages/contracts. `check_import` calls it too.
pub(crate) fn replaced_version(migration: &Migration) -> Result<Option<i64>, String> {
    // A valid line 1 is the prefix, 4 ASCII digits, and `\n`. `get` answers None on a short text.
    let line_one = migration
        .sql
        .strip_prefix(REPLACES_PREFIX)
        .and_then(|rest| {
            let digits = rest
                .get(..4)
                .filter(|digits| digits.bytes().all(|byte| byte.is_ascii_digit()))?;
            let body = rest.get(4..)?.strip_prefix('\n')?;
            Some((digits.parse::<i64>().ok()?, body))
        });
    let (target, body) = match line_one {
        Some((target, body)) => (Some(target), body),
        None => (None, migration.sql),
    };
    // A typo, CRLF, version 0, or a marker on a later line puts the file in a wrong place.
    let has_bad_marker = body.split('\n').any(|line| line.starts_with(MARKER_PREFIX));
    if has_bad_marker || target == Some(0) {
        return Err(format!(
            "Migration {} has a bad \"-- wandit:\" line. Only line 1 may hold \"-- wandit:replaces NNNN\".",
            file_name(migration)
        ));
    }
    Ok(target)
}

// Step 6: reads line 1 of every file and checks each replacement against its target.
// Answers the target version of each file, in the order of `migrations`.
fn read_replacement_targets(migrations: &[Migration]) -> Result<Vec<Option<i64>>, String> {
    let targets = migrations
        .iter()
        .map(replaced_version)
        .collect::<Result<Vec<_>, _>>()?;
    for (migration, target) in migrations.iter().zip(&targets) {
        let Some(target) = *target else {
            continue;
        };
        let version = migration.version;
        let Some(target_index) = migrations.iter().position(|file| file.version == target) else {
            return Err(format!(
                "Migration {version} replaces migration {target}, which this build does not hold."
            ));
        };
        // Step 9 runs a replacement at the place of its target, so the target comes first.
        if target >= version {
            return Err(format!(
                "Migration {version} replaces migration {target}, which is not an earlier version."
            ));
        }
        // Step 9 looks for the replacements of a plain file only. A chain never runs.
        if targets[target_index].is_some() {
            return Err(format!(
                "Migration {version} replaces migration {target}, which replaces another migration."
            ));
        }
    }
    Ok(targets)
}

// Step 9: walks the files in version order inside the transaction of step 8. A target runs
// its newest replacement in its place. Every embedded version gets exactly one ledger row.
// `targets` holds the target version of each file of `migrations`, from step 6.
fn apply_pending(
    conn: &Connection,
    migrations: &[Migration],
    targets: &[Option<i64>],
    pending: &[&Migration],
    app_version: &str,
) -> Result<(), String> {
    let run = |migration: &Migration| {
        run_file(conn, migration.sql)
            .map_err(|error| format!("Migration {} failed: {error}", file_name(migration)))
    };
    let mut recorded = HashSet::new();
    for (migration, target) in migrations.iter().zip(targets) {
        let is_pending = pending.iter().any(|file| file.version == migration.version);
        if !is_pending || recorded.contains(&migration.version) {
            continue;
        }
        // Its target is in the ledger from an earlier start, so the target ran already.
        if target.is_some() {
            record_migration(conn, &mut recorded, migration, "skipped", app_version)?;
            continue;
        }
        let alternatives: Vec<&Migration> = migrations
            .iter()
            .zip(targets)
            .filter(|(_, target)| **target == Some(migration.version))
            .map(|(alternative, _)| alternative)
            .collect();
        let Some(newest) = alternatives.last() else {
            run(migration)?;
            record_migration(conn, &mut recorded, migration, "applied", app_version)?;
            continue;
        };
        run(newest)?;
        record_migration(conn, &mut recorded, migration, "replaced", app_version)?;
        for alternative in &alternatives {
            let status = if alternative.version == newest.version {
                "applied"
            } else {
                "skipped"
            };
            record_migration(conn, &mut recorded, alternative, status, app_version)?;
        }
    }
    Ok(())
}

// Writes the ledger row of one file and adds its version to `recorded`.
// `status` is `applied`, `replaced`, or `skipped` (see `CREATE_LEDGER_SQL`).
fn record_migration(
    conn: &Connection,
    recorded: &mut HashSet<i64>,
    migration: &Migration,
    status: &str,
    app_version: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO wandit_migrations (version, name, sha256, status, recorded_at, app_version) \
         VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?5)",
        (
            migration.version,
            migration.name,
            migration.sha256,
            status,
            app_version,
        ),
    )
    .map_err(|error| {
        format!(
            "Migration {} failed: The ledger row could not be written: {error}",
            file_name(migration)
        )
    })?;
    recorded.insert(migration.version);
    Ok(())
}

// Runs the statements of one file in order. A statement that writes nothing and answers
// columns is a check. It must answer one row with the integer 1.
fn run_file(conn: &Connection, sql: &str) -> Result<(), String> {
    let mut statements = Batch::new(conn, sql);
    let mut number = 0;
    loop {
        // A statement that does not prepare comes after the last one that ran.
        let next = statements.next().map_err(|error| {
            // rusqlite adds the rest of the file and an offset to a prepare error.
            // The gate and the preview show only the SQLite text, so the shell does too.
            let error = match error {
                rusqlite::Error::SqlInputError { msg, .. } => msg,
                other => other.to_string(),
            };
            format!("Statement {}: {error}", number + 1)
        })?;
        let Some(mut statement) = next else {
            return Ok(());
        };
        number += 1;
        let failed = |error: rusqlite::Error| format!("Statement {number}: {error}");
        if statement.readonly() && statement.column_count() > 0 {
            if let Some(reason) = check_failure(&mut statement).map_err(failed)? {
                let text: String = statement
                    .expanded_sql()
                    .unwrap_or_default()
                    .trim()
                    .chars()
                    .take(MAX_CHECK_TEXT_CHARS)
                    .collect();
                return Err(format!(
                    "Statement {number} is a check that {reason}: {text}"
                ));
            }
        } else {
            // Step to the end, so an INSERT ... RETURNING writes every row.
            let mut rows = statement.raw_query();
            while rows.next().map_err(failed)?.is_some() {}
        }
    }
}

// Answers why a check failed, or None when it answered one row with the integer 1.
// The gate and the preview test the answer in the same order, with the same reasons.
fn check_failure(statement: &mut Statement<'_>) -> rusqlite::Result<Option<String>> {
    let columns = statement.column_count();
    if columns != 1 {
        return Ok(Some(format!("answered {columns} columns, not 1")));
    }
    let mut rows = statement.raw_query();
    let Some(row) = rows.next()? else {
        return Ok(Some("answered no row".to_owned()));
    };
    let value: Value = row.get(0)?;
    if rows.next()?.is_some() {
        return Ok(Some("answered more than one row".to_owned()));
    }
    let shown = match value {
        Value::Integer(1) => return Ok(None),
        Value::Null => "NULL".to_owned(),
        Value::Integer(integer) => integer.to_string(),
        // `Display` shows 1.0 as `1`, as JavaScript does.
        Value::Real(real) => format!("{real} (REAL)"),
        Value::Text(text) => format!(
            "'{}'",
            text.chars().take(MAX_SHOWN_TEXT_CHARS).collect::<String>()
        ),
        Value::Blob(_) => "a BLOB".to_owned(),
    };
    Ok(Some(format!("answered {shown}, not the integer 1")))
}

thread_local! {
    /// True while the shell itself runs BEGIN, COMMIT, or ROLLBACK for `db_batch`.
    /// SQLite calls the authorizer on the thread that prepares the statement.
    /// That thread holds the database lock, so a webview statement never sees `true`.
    static SHELL_TRANSACTION: Cell<bool> = const { Cell::new(false) };
}

/// Installs the statement rules of section 4 on the app connection, after the runner.
pub fn install_authorizer(conn: &mut Connection) -> rusqlite::Result<()> {
    conn.authorizer(Some(authorize))
}

/// Runs the body of one webview command with a time limit. lib.rs passes `COMMAND_TIME_LIMIT`.
/// After the limit, SQLite stops the statement that runs, and the command answers `sql_error`.
/// The limit ends with the call, so the runner, the backups, the export, and the import have none.
pub fn run_with_time_limit<T>(
    conn: &mut Connection,
    limit: Duration,
    body: impl FnOnce(&Connection) -> Result<T, DbError>,
) -> Result<T, DbError> {
    let deadline = Instant::now() + limit;
    // Security: a command never runs without the limit, so a failed install refuses the call.
    conn.progress_handler(PROGRESS_STEPS, Some(move || Instant::now() >= deadline))?;
    let result = body(conn);
    // rusqlite removes the SQLite handler before this can fail. A failure only keeps the old
    // closure in memory until the connection closes, so a log is enough.
    if let Err(error) = conn.progress_handler(PROGRESS_STEPS, None::<fn() -> bool>) {
        eprintln!("The time limit of the database could not be removed: {error}");
    }
    result
}

// The statement rules of section 4. SQLite asks for each action while it prepares a
// statement, also for the actions inside triggers and views.
fn authorize(context: AuthContext<'_>) -> Authorization {
    let allowed = match context.action {
        AuthAction::Select
        | AuthAction::Read { .. }
        | AuthAction::Function { .. }
        | AuthAction::Recursive => true,
        AuthAction::Insert { table_name }
        | AuthAction::Update { table_name, .. }
        | AuthAction::Delete { table_name } => !is_shell_table(table_name),
        AuthAction::Transaction { .. } => SHELL_TRANSACTION.get(),
        // Refused: ATTACH, DETACH, PRAGMA, every CREATE, DROP, and ALTER, REINDEX, and ANALYZE.
        // Also refused: virtual tables, SAVEPOINT, RELEASE, and each action that a newer SQLite adds.
        _ => false,
    };
    if allowed {
        Authorization::Allow
    } else {
        Authorization::Deny
    }
}

// The ledger and the internal tables of SQLite. The webview may read them, never write them.
fn is_shell_table(table_name: &str) -> bool {
    table_name.eq_ignore_ascii_case("wandit_migrations")
        || table_name
            .get(..7)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("sqlite_"))
}

// Runs a BEGIN, COMMIT, or ROLLBACK of the shell itself past the authorizer.
fn run_shell_statement(conn: &Connection, sql: &str) -> rusqlite::Result<()> {
    SHELL_TRANSACTION.set(true);
    let result = conn.execute_batch(sql);
    SHELL_TRANSACTION.set(false);
    result
}

// Ends the open transaction without its changes and answers `message`. When ROLLBACK
// also fails, the answer holds both errors.
fn rollback_with(conn: &Connection, message: String) -> String {
    // SQLite ends the transaction by itself after some errors, for example SQLITE_FULL.
    if conn.is_autocommit() {
        return message;
    }
    match run_shell_statement(conn, "ROLLBACK") {
        Ok(()) => message,
        Err(error) => format!("{message} The rollback also failed: {error}"),
    }
}

fn invalid_input(message: impl Into<String>) -> DbError {
    DbError::new(DbErrorCode::InvalidInput, message)
}

fn unsupported_value(message: &str) -> DbError {
    DbError::new(DbErrorCode::UnsupportedValue, message)
}

// Converts one param of the webview to an SQLite value (section 4).
fn to_sql_param(param: &serde_json::Value) -> Result<Value, DbError> {
    match param {
        serde_json::Value::Null => Ok(Value::Null),
        serde_json::Value::Bool(flag) => Ok(Value::Integer(i64::from(*flag))),
        serde_json::Value::String(text) => Ok(Value::Text(text.clone())),
        serde_json::Value::Number(number) => number_to_sql(number),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => Err(invalid_input(
            "A param must be null, a boolean, a number, or a string.",
        )),
    }
}

// An integer inside the safe range of JavaScript stays exact as INTEGER. Every other
// number is REAL.
fn number_to_sql(number: &serde_json::Number) -> Result<Value, DbError> {
    let safe_range = -MAX_SAFE_INTEGER..=MAX_SAFE_INTEGER;
    if let Some(integer) = number
        .as_i64()
        .filter(|integer| safe_range.contains(integer))
    {
        return Ok(Value::Integer(integer));
    }
    let Some(float) = number.as_f64().filter(|float| float.is_finite()) else {
        return Err(unsupported_value("A param number is not finite."));
    };
    // JSON text like `1e3` is a float in serde_json, but it is the integer 1000.
    if float.fract() == 0.0 && float.abs() <= MAX_SAFE_INTEGER as f64 {
        return Ok(Value::Integer(float as i64));
    }
    Ok(Value::Real(float))
}

// Converts one result value to the webview type (section 4).
fn to_sql_value(value: ValueRef<'_>) -> Result<SqlValue, DbError> {
    match value {
        ValueRef::Null => Ok(SqlValue::Null),
        ValueRef::Integer(integer) => Ok(SqlValue::Integer(integer)),
        // JSON has no Infinity and no NaN.
        ValueRef::Real(float) if float.is_finite() => Ok(SqlValue::Real(float)),
        ValueRef::Real(_) => Err(unsupported_value("A REAL value is not finite.")),
        ValueRef::Text(bytes) => std::str::from_utf8(bytes)
            .map(|text| SqlValue::Text(text.to_owned()))
            .map_err(|_| unsupported_value("A TEXT value is not UTF-8.")),
        ValueRef::Blob(_) => Err(unsupported_value(
            "BLOB values are not supported. Store a file as base64 text.",
        )),
    }
}

// Prepares exactly one statement and binds its params, after the limits of section 4.
fn prepare_one<'c>(
    conn: &'c Connection,
    sql: &str,
    params: &[serde_json::Value],
) -> Result<Statement<'c>, DbError> {
    if sql.len() > MAX_SQL_BYTES {
        return Err(invalid_input(format!(
            "The SQL text is larger than {MAX_SQL_BYTES} bytes."
        )));
    }
    if params.len() > MAX_PARAMS {
        return Err(invalid_input(format!(
            "A statement takes at most {MAX_PARAMS} params."
        )));
    }
    let mut statements = Batch::new(conn, sql);
    let Some(mut statement) = statements.next()? else {
        return Err(invalid_input("The SQL text holds no statement."));
    };
    // Text after the first statement, other than spaces and comments, is a second
    // statement, also when it does not prepare.
    if !matches!(statements.next(), Ok(None)) {
        return Err(invalid_input(
            "Send one statement per call. db_batch runs several statements.",
        ));
    }
    if statement.parameter_count() != params.len() {
        return Err(invalid_input(format!(
            "The statement has {} params, but the call gives {}.",
            statement.parameter_count(),
            params.len()
        )));
    }
    for (index, param) in params.iter().enumerate() {
        statement.raw_bind_parameter(index + 1, to_sql_param(param)?)?;
    }
    Ok(statement)
}

/// Body of `db_select`: one statement that does not write, at most 10,000 rows.
pub fn select(
    conn: &Connection,
    sql: &str,
    params: &[serde_json::Value],
) -> Result<SelectAnswer, DbError> {
    let mut statement = prepare_one(conn, sql, params)?;
    // `sqlite3_stmt_readonly`: a statement that writes needs db_execute.
    if !statement.readonly() {
        return Err(DbError::new(
            DbErrorCode::StatementRefused,
            "db_select runs only a statement that does not write. Use db_execute.",
        ));
    }
    let columns: Vec<String> = statement.column_names().map(String::from).collect();
    let mut rows = Vec::new();
    let mut cursor = statement.raw_query();
    while let Some(row) = cursor.next()? {
        if rows.len() == MAX_SELECT_ROWS {
            return Err(DbError::new(
                DbErrorCode::TooManyRows,
                format!(
                    "The query answers more than {MAX_SELECT_ROWS} rows. Add LIMIT and OFFSET."
                ),
            ));
        }
        let values = (0..columns.len())
            .map(|index| {
                row.get_ref(index)
                    .map_err(DbError::from)
                    .and_then(to_sql_value)
            })
            .collect::<Result<Vec<_>, _>>()?;
        rows.push(values);
    }
    Ok(SelectAnswer { columns, rows })
}

/// Body of `db_execute`, and of each statement of `db_batch`: INSERT, UPDATE, DELETE, or SELECT.
pub fn execute(
    conn: &Connection,
    sql: &str,
    params: &[serde_json::Value],
) -> Result<ExecuteAnswer, DbError> {
    let mut statement = prepare_one(conn, sql, params)?;
    let writes = !statement.readonly();
    // Step to the end, so a write with RETURNING runs fully.
    let mut cursor = statement.raw_query();
    while cursor.next()?.is_some() {}
    // `sqlite3_changes` keeps the count of the last write, so a read reports 0 here.
    let changes = if writes { conn.changes() } else { 0 };
    Ok(ExecuteAnswer {
        changes,
        last_insert_row_id: conn.last_insert_rowid(),
    })
}

/// Body of `db_batch`: at most 500 statements in one transaction, all or none.
pub fn batch(conn: &Connection, statements: &[BatchStatement]) -> Result<BatchAnswer, DbError> {
    if statements.len() > MAX_BATCH_STATEMENTS {
        return Err(invalid_input(format!(
            "A batch holds at most {MAX_BATCH_STATEMENTS} statements."
        )));
    }
    run_shell_statement(conn, "BEGIN IMMEDIATE")?;
    let mut results = Vec::with_capacity(statements.len());
    for (index, input) in statements.iter().enumerate() {
        match execute(
            conn,
            &input.sql,
            input.params.as_deref().unwrap_or_default(),
        ) {
            Ok(answer) => results.push(answer),
            Err(error) => {
                let message = format!("Statement {}: {}", index + 1, error.message);
                return Err(DbError::new(error.code, rollback_with(conn, message)));
            }
        }
    }
    // A deferred foreign key fails only at COMMIT.
    if let Err(error) = run_shell_statement(conn, "COMMIT") {
        let error = DbError::from(error);
        return Err(DbError::new(error.code, rollback_with(conn, error.message)));
    }
    Ok(BatchAnswer { results })
}

/// Body of `app_info`. `last_backup_at` comes from backup.rs, which owns the backup folder.
pub fn app_info(
    conn: &Connection,
    db_file: &Path,
    version: String,
    last_backup_at: Option<String>,
) -> Result<AppInfo, DbError> {
    let schema_version = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM wandit_migrations",
        [],
        |row| row.get(0),
    )?;
    Ok(AppInfo {
        version,
        schema_version,
        database_bytes: database_bytes(db_file)?,
        last_backup_at,
    })
}

// The WAL file holds the newest writes until a checkpoint, so it counts too.
fn database_bytes(db_file: &Path) -> Result<u64, DbError> {
    let size_error = |error: io::Error| {
        DbError::new(
            DbErrorCode::SqlError,
            format!("The database size is not readable: {error}"),
        )
    };
    let main = fs::metadata(db_file).map_err(size_error)?.len();
    let wal = match fs::metadata(sidecar_path(db_file, "-wal")) {
        Ok(metadata) => metadata.len(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => 0,
        Err(error) => return Err(size_error(error)),
    };
    Ok(main + wal)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::{migration, test_dir};
    use serde_json::json;

    const NOTES: &str =
        "CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL);";

    fn memory_database() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        apply_safety_settings(&conn).unwrap();
        conn
    }

    fn no_backup(_: &Connection) -> Result<(), String> {
        panic!("the runner must not write a backup here");
    }

    fn table_names(conn: &Connection) -> Vec<String> {
        let mut statement = conn
            .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .unwrap();
        let rows = statement.query_map([], |row| row.get(0)).unwrap();
        rows.collect::<rusqlite::Result<_>>().unwrap()
    }

    fn ledger_versions(conn: &Connection) -> Vec<i64> {
        read_ledger(conn)
            .unwrap()
            .into_iter()
            .map(|(version, _)| version)
            .collect()
    }

    // The ledger as (version, status) rows, sorted by version.
    fn ledger_rows(conn: &Connection) -> Vec<(i64, String)> {
        let mut statement = conn
            .prepare("SELECT version, status FROM wandit_migrations ORDER BY version")
            .unwrap();
        let rows = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap();
        rows.collect::<rusqlite::Result<_>>().unwrap()
    }

    // `expected` in the shape of `ledger_rows`.
    fn rows(expected: &[(i64, &str)]) -> Vec<(i64, String)> {
        expected
            .iter()
            .map(|(version, status)| (*version, (*status).to_owned()))
            .collect()
    }

    // File 2 of the replacement tests: a NOT NULL insert that fails on every install.
    const BROKEN_TAGS: &str =
        "CREATE TABLE tags (name TEXT NOT NULL); INSERT INTO tags (name) VALUES (NULL);";
    // The fix of BROKEN_TAGS: the same CREATE statement without the insert.
    const TAGS_FIX: &str = "-- wandit:replaces 0002\nCREATE TABLE tags (name TEXT NOT NULL);";

    // A migrated database with the authorizer, as the commands see it.
    fn app_database() -> Connection {
        let mut conn = memory_database();
        let migrations = [migration(1, "init", NOTES)];
        run_migrations(&conn, &migrations, "1.0.1", no_backup).unwrap();
        install_authorizer(&mut conn).unwrap();
        conn
    }

    #[test]
    fn runner_migrates_a_fresh_database_without_a_backup() {
        let conn = memory_database();
        let migrations = [
            migration(1, "init", NOTES),
            migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
        ];
        run_migrations(&conn, &migrations, "1.0.1", no_backup).unwrap();
        assert_eq!(ledger_versions(&conn), [1, 2]);
        assert_eq!(table_names(&conn), ["notes", "tags", "wandit_migrations"]);
    }

    #[test]
    fn runner_writes_a_backup_before_it_migrates_saved_data() {
        let dir = test_dir("runner-backup");
        let conn = open_database(&dir.join("app.db")).unwrap();
        run_migrations(&conn, &[migration(1, "init", NOTES)], "1.0.1", no_backup).unwrap();
        conn.execute("INSERT INTO notes (body) VALUES ('saved')", [])
            .unwrap();

        let migrations = [
            migration(1, "init", NOTES),
            migration(
                2,
                "add_pinned",
                "ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;",
            ),
        ];
        let backups = dir.join("backups");
        run_migrations(&conn, &migrations, "1.0.2", |conn| {
            crate::backup::write_backup(
                conn,
                &backups,
                crate::backup::BackupKind::BeforeMigration("1.0.2"),
            )
            .map(drop)
        })
        .unwrap();

        assert_eq!(ledger_versions(&conn), [1, 2]);
        let backup_file = fs::read_dir(&backups)
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        let name = backup_file
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .to_owned();
        assert!(name.starts_with("before-1.0.2-"), "{name}");
        // The backup holds the data before the migration.
        let copy = open_read_only(&backup_file).unwrap();
        assert_eq!(ledger_versions(&copy), [1]);
        let body: String = copy
            .query_row("SELECT body FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(body, "saved");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn runner_refuses_a_changed_migration() {
        let conn = memory_database();
        run_migrations(&conn, &[migration(1, "init", NOTES)], "1.0.1", no_backup).unwrap();
        let changed = [
            migration(1, "init", "CREATE TABLE notes (id INTEGER PRIMARY KEY);"),
            migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
        ];
        let error = run_migrations(&conn, &changed, "1.0.2", no_backup).unwrap_err();
        assert!(
            error.contains("Migration 1 of this build differs"),
            "{error}"
        );
        assert_eq!(ledger_versions(&conn), [1]);
    }

    #[test]
    fn runner_refuses_a_pending_version_below_the_database_version() {
        let conn = memory_database();
        let newer = [
            migration(1, "init", NOTES),
            migration(3, "add_tags", "CREATE TABLE tags (name TEXT);"),
        ];
        run_migrations(&conn, &newer, "1.0.1", no_backup).unwrap();
        let with_gap = [
            migration(1, "init", NOTES),
            migration(2, "add_files", "CREATE TABLE files (name TEXT);"),
            migration(3, "add_tags", "CREATE TABLE tags (name TEXT);"),
        ];
        let error = run_migrations(&conn, &with_gap, "1.0.2", |_| Ok(())).unwrap_err();
        assert!(error.contains("Migration 2 is below version 3"), "{error}");
        assert_eq!(table_names(&conn), ["notes", "tags", "wandit_migrations"]);
    }

    #[test]
    fn runner_accepts_a_database_ahead_of_the_app() {
        let conn = memory_database();
        let newer = [
            migration(1, "init", NOTES),
            migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
        ];
        run_migrations(&conn, &newer, "1.0.2", no_backup).unwrap();
        // A rollback to the build that embeds only migration 1.
        run_migrations(&conn, &[migration(1, "init", NOTES)], "1.0.1", no_backup).unwrap();
        assert_eq!(ledger_versions(&conn), [1, 2]);
    }

    #[test]
    fn runner_rolls_back_every_pending_file_when_one_fails() {
        let conn = memory_database();
        let migrations = [
            migration(1, "init", NOTES),
            migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
            // rusqlite gives this prepare error with the SQL text and an offset.
            migration(
                3,
                "broken",
                "CREATE TABLE files (name TEXT); SELECT nope FROM files;\nCREATE TABLE pins (x);",
            ),
        ];
        let error = run_migrations(&conn, &migrations, "1.0.1", no_backup).unwrap_err();
        assert_eq!(
            error,
            "Migration 0003_broken.sql failed: Statement 2: no such column: nope"
        );
        // The files before the failed file are gone too.
        assert!(ledger_versions(&conn).is_empty());
        assert_eq!(table_names(&conn), ["wandit_migrations"]);
        assert!(conn.is_autocommit());
    }

    #[test]
    fn runner_runs_a_replacement_at_the_place_of_its_target() {
        let conn = memory_database();
        let migrations = [
            migration(1, "init", NOTES),
            migration(2, "add_tags", BROKEN_TAGS),
            migration(3, "index_tags", "CREATE INDEX tags_name ON tags (name);"),
            migration(4, "add_tags_fix", TAGS_FIX),
        ];
        run_migrations(&conn, &migrations, "1.0.1", no_backup).unwrap();
        assert_eq!(
            ledger_rows(&conn),
            rows(&[
                (1, "applied"),
                (2, "replaced"),
                (3, "applied"),
                (4, "applied")
            ])
        );
    }

    #[test]
    fn runner_skips_a_replacement_when_the_database_ran_its_target() {
        let conn = memory_database();
        let tags = "CREATE TABLE tags (name TEXT NOT NULL);";
        run_migrations(
            &conn,
            &[migration(1, "init", NOTES), migration(2, "add_tags", tags)],
            "1.0.1",
            no_backup,
        )
        .unwrap();
        let migrations = [
            migration(1, "init", NOTES),
            migration(2, "add_tags", tags),
            migration(4, "add_tags_fix", TAGS_FIX),
        ];
        run_migrations(&conn, &migrations, "1.0.2", |_| Ok(())).unwrap();
        assert_eq!(
            ledger_rows(&conn),
            rows(&[(1, "applied"), (2, "applied"), (4, "skipped")])
        );
    }

    #[test]
    fn runner_runs_only_the_newest_replacement() {
        let conn = memory_database();
        let migrations = [
            migration(1, "init", NOTES),
            migration(2, "add_tags", BROKEN_TAGS),
            migration(
                3,
                "add_tags_fix",
                "-- wandit:replaces 0002\nCREATE TABLE tags (name TEXT NOT NULL); SELECT 0;",
            ),
            migration(4, "add_tags_fix_two", TAGS_FIX),
        ];
        run_migrations(&conn, &migrations, "1.0.1", no_backup).unwrap();
        assert_eq!(
            ledger_rows(&conn),
            rows(&[
                (1, "applied"),
                (2, "replaced"),
                (3, "skipped"),
                (4, "applied")
            ])
        );
    }

    #[test]
    fn runner_refuses_a_bad_replacement_group() {
        let bad_line =
            "has a bad \"-- wandit:\" line. Only line 1 may hold \"-- wandit:replaces NNNN\".";
        let cases = [
            (
                vec![migration(3, "fix", "-- wandit:replaces 0002\nSELECT 1;")],
                "Migration 3 replaces migration 2, which this build does not hold.".to_owned(),
            ),
            (
                vec![
                    migration(2, "fix", "-- wandit:replaces 0001\nSELECT 1;"),
                    migration(3, "fix_two", "-- wandit:replaces 0002\nSELECT 1;"),
                ],
                "Migration 3 replaces migration 2, which replaces another migration.".to_owned(),
            ),
            (
                vec![migration(2, "fix", "-- wandit:replaces 0002\nSELECT 1;")],
                "Migration 2 replaces migration 2, which is not an earlier version.".to_owned(),
            ),
            (
                vec![migration(
                    2,
                    "fix",
                    "CREATE TABLE a (x);\n-- wandit:replaces 0001\n",
                )],
                format!("Migration 0002_fix.sql {bad_line}"),
            ),
            (
                vec![migration(
                    2,
                    "fix",
                    "-- wandit:replaces 0000\nCREATE TABLE a (x);",
                )],
                format!("Migration 0002_fix.sql {bad_line}"),
            ),
        ];
        for (files, expected) in cases {
            let conn = memory_database();
            let mut migrations = vec![migration(1, "init", NOTES)];
            migrations.extend(files);
            let error = run_migrations(&conn, &migrations, "1.0.1", no_backup).unwrap_err();
            assert_eq!(error, expected);
            assert!(ledger_versions(&conn).is_empty(), "{expected}");
        }

        // An install with nothing pending still opens with a bad group (R12h).
        let conn = memory_database();
        run_migrations(&conn, &[migration(1, "init", NOTES)], "1.0.1", no_backup).unwrap();
        let missing_target = migration(3, "fix", "-- wandit:replaces 0002\nSELECT 1;");
        conn.execute(
            "INSERT INTO wandit_migrations VALUES (3, 'fix', ?1, 'skipped', 'x', 'x')",
            [missing_target.sha256],
        )
        .unwrap();
        let migrations = [migration(1, "init", NOTES), missing_target];
        assert_eq!(
            run_migrations(&conn, &migrations, "1.0.2", no_backup),
            Ok(())
        );
    }

    #[test]
    fn runner_accepts_only_the_integer_1_as_a_check() {
        let cases = [
            ("SELECT 1;", None),
            ("SELECT 0;", Some("answered 0, not the integer 1")),
            ("SELECT 1.0;", Some("answered 1 (REAL), not the integer 1")),
            ("SELECT '1';", Some("answered '1', not the integer 1")),
            ("SELECT NULL;", Some("answered NULL, not the integer 1")),
            ("SELECT 1, 1;", Some("answered 2 columns, not 1")),
            ("SELECT 1 WHERE 0;", Some("answered no row")),
            (
                "SELECT 1 UNION ALL SELECT 1;",
                Some("answered more than one row"),
            ),
        ];
        for (sql, reason) in cases {
            let conn = memory_database();
            let result = run_migrations(&conn, &[migration(1, "check", sql)], "1.0.1", no_backup);
            match reason {
                None => {
                    assert_eq!(result, Ok(()), "{sql}");
                    assert_eq!(ledger_versions(&conn), [1], "{sql}");
                }
                Some(reason) => {
                    assert_eq!(
                        result,
                        Err(format!(
                            "Migration 0001_check.sql failed: Statement 1 is a check that {reason}: {sql}"
                        ))
                    );
                    assert!(ledger_versions(&conn).is_empty(), "{sql}");
                }
            }
        }
    }

    #[test]
    fn runner_stops_when_the_backup_fails() {
        let conn = memory_database();
        run_migrations(&conn, &[migration(1, "init", NOTES)], "1.0.1", no_backup).unwrap();
        let migrations = [
            migration(1, "init", NOTES),
            migration(2, "add_tags", "CREATE TABLE tags (name TEXT);"),
        ];
        let error = run_migrations(&conn, &migrations, "1.0.2", |_| Err("disk full".to_owned()))
            .unwrap_err();
        assert!(
            error.contains("backup before the migration failed: disk full"),
            "{error}"
        );
        assert_eq!(ledger_versions(&conn), [1]);
        assert_eq!(table_names(&conn), ["notes", "wandit_migrations"]);
    }

    #[test]
    fn authorizer_refuses_every_statement_off_the_rules() {
        let conn = app_database();
        let refused = [
            "ATTACH DATABASE 'other.db' AS other",
            "PRAGMA foreign_keys = OFF",
            "CREATE TABLE extra (id INTEGER)",
            "CREATE TEMP TABLE scratch (id INTEGER)",
            "DROP TABLE notes",
            "ALTER TABLE notes ADD COLUMN extra TEXT",
            "INSERT INTO wandit_migrations VALUES (9, 'x', 'x', 'applied', 'x', 'x')",
            "DELETE FROM wandit_migrations",
            "UPDATE sqlite_sequence SET seq = 0",
            "BEGIN",
            "SAVEPOINT inner_step",
            "COMMIT",
        ];
        for sql in refused {
            let error = execute(&conn, sql, &[]).unwrap_err();
            assert_eq!(
                error.code,
                DbErrorCode::StatementRefused,
                "{sql}: {}",
                error.message
            );
        }
        assert_eq!(ledger_versions(&conn), [1]);
    }

    #[test]
    fn vacuum_into_writes_no_file() {
        let conn = app_database();
        let dir = test_dir("vacuum");
        let target = dir.join("copy.db");
        let sql = format!("VACUUM INTO '{}'", target.display());
        assert!(execute(&conn, &sql, &[]).is_err());
        assert!(!target.exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn db_select_refuses_a_write() {
        let conn = app_database();
        let error = select(
            &conn,
            "INSERT INTO notes (body) VALUES ('x') RETURNING id",
            &[],
        )
        .unwrap_err();
        assert_eq!(error.code, DbErrorCode::StatementRefused);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn rows_of_an_autoincrement_table_can_be_written() {
        // SQLite writes `sqlite_sequence` itself. The authorizer must not refuse that write.
        let conn = app_database();
        let insert = execute(
            &conn,
            "INSERT INTO notes (body) VALUES (?)",
            &[json!("first")],
        )
        .unwrap();
        assert_eq!(
            insert,
            ExecuteAnswer {
                changes: 1,
                last_insert_row_id: 1
            }
        );
        let update = execute(
            &conn,
            "UPDATE notes SET body = ? WHERE id = ?",
            &[json!("edited"), json!(1)],
        )
        .unwrap();
        assert_eq!(update.changes, 1);
        let read = execute(&conn, "SELECT * FROM notes", &[]).unwrap();
        assert_eq!(read.changes, 0);
        assert_eq!(execute(&conn, "DELETE FROM notes", &[]).unwrap().changes, 1);
    }

    #[test]
    fn batch_is_all_or_none() {
        let conn = app_database();
        let statements = vec![
            BatchStatement {
                sql: "INSERT INTO notes (body) VALUES ('a')".into(),
                params: None,
            },
            BatchStatement {
                sql: "INSERT INTO notes (body) VALUES (NULL)".into(),
                params: None,
            },
        ];
        let error = batch(&conn, &statements).unwrap_err();
        assert_eq!(error.code, DbErrorCode::SqlError);
        assert!(
            error.message.starts_with("Statement 2:"),
            "{}",
            error.message
        );
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
        assert!(conn.is_autocommit());

        let answer = batch(&conn, &statements[..1]).unwrap();
        assert_eq!(
            answer.results,
            [ExecuteAnswer {
                changes: 1,
                last_insert_row_id: 1
            }]
        );
    }

    #[test]
    fn limits_give_invalid_input() {
        let conn = app_database();
        let long_sql = format!("SELECT '{}'", "x".repeat(MAX_SQL_BYTES));
        let many_params = vec![json!(1); MAX_PARAMS + 1];
        let cases: [(&str, &[serde_json::Value]); 6] = [
            (&long_sql, &[]),
            ("SELECT 1", &many_params),
            ("SELECT 1; SELECT 2", &[]),
            // The second statement fails to prepare, but it is still a second statement.
            ("SELECT 1; DROP TABLE notes", &[]),
            ("  -- only a comment", &[]),
            ("SELECT ?", &[]),
        ];
        for (sql, params) in cases {
            let error = execute(&conn, sql, params).unwrap_err();
            assert_eq!(error.code, DbErrorCode::InvalidInput, "{}", error.message);
        }
        let too_many_statements: Vec<BatchStatement> = (0..=MAX_BATCH_STATEMENTS)
            .map(|_| BatchStatement {
                sql: "SELECT 1".into(),
                params: None,
            })
            .collect();
        assert_eq!(
            batch(&conn, &too_many_statements).unwrap_err().code,
            DbErrorCode::InvalidInput
        );
        assert!(execute(&conn, "SELECT 1; -- a trailing comment", &[]).is_ok());
    }

    #[test]
    fn db_select_answers_at_most_10000_rows() {
        let conn = app_database();
        let rows = |count: usize| {
            format!("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < {count}) SELECT x FROM n")
        };
        assert_eq!(
            select(&conn, &rows(MAX_SELECT_ROWS), &[])
                .unwrap()
                .rows
                .len(),
            MAX_SELECT_ROWS
        );
        let error = select(&conn, &rows(MAX_SELECT_ROWS + 1), &[]).unwrap_err();
        assert_eq!(error.code, DbErrorCode::TooManyRows);
    }

    // A query that never ends must not hold the database lock: the update install waits for it.
    #[test]
    fn time_limit_stops_a_statement_that_never_ends() {
        let mut conn = app_database();
        let endless =
            "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT count(*) FROM c";
        let limit = Duration::from_millis(100);
        let error =
            run_with_time_limit(&mut conn, limit, |conn| select(conn, endless, &[])).unwrap_err();
        assert_eq!(error.code, DbErrorCode::SqlError);
        assert!(
            error.message.starts_with("interrupted"),
            "{}",
            error.message
        );

        // A stopped batch keeps no row and no open transaction.
        let statements = vec![
            BatchStatement {
                sql: "INSERT INTO notes (body) VALUES ('a')".into(),
                params: None,
            },
            BatchStatement {
                sql: endless.into(),
                params: None,
            },
        ];
        run_with_time_limit(&mut conn, limit, |conn| batch(conn, &statements)).unwrap_err();
        assert!(conn.is_autocommit());

        // The limit ends with the call, so a long statement of the backup or the runner ends normally.
        let count: i64 = conn
            .query_row(
                "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 100000) SELECT count(*) FROM c",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 100_000);
        let notes: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(notes, 0);
    }

    #[test]
    fn params_map_to_sqlite_values() {
        let cases = [
            (json!(null), Value::Null),
            (json!(true), Value::Integer(1)),
            (json!(false), Value::Integer(0)),
            (json!(-42), Value::Integer(-42)),
            (json!(MAX_SAFE_INTEGER), Value::Integer(MAX_SAFE_INTEGER)),
            (
                json!(MAX_SAFE_INTEGER + 1),
                Value::Real(9_007_199_254_740_992.0),
            ),
            (json!(u64::MAX), Value::Real(u64::MAX as f64)),
            (json!(1.5), Value::Real(1.5)),
            (serde_json::from_str("1e3").unwrap(), Value::Integer(1000)),
            (json!("text"), Value::Text("text".into())),
        ];
        for (param, expected) in cases {
            assert_eq!(to_sql_param(&param).unwrap(), expected, "{param}");
        }
        assert_eq!(
            to_sql_param(&json!([1])).unwrap_err().code,
            DbErrorCode::InvalidInput
        );
        assert_eq!(
            to_sql_param(&json!({ "a": 1 })).unwrap_err().code,
            DbErrorCode::InvalidInput
        );
    }

    #[test]
    fn results_map_to_webview_values() {
        let conn = app_database();
        let answer = select(
            &conn,
            "SELECT NULL AS a, 42 AS b, 1.5 AS c, 'text' AS d",
            &[],
        )
        .unwrap();
        assert_eq!(answer.columns, ["a", "b", "c", "d"]);
        assert_eq!(
            answer.rows,
            [vec![
                SqlValue::Null,
                SqlValue::Integer(42),
                SqlValue::Real(1.5),
                SqlValue::Text("text".into())
            ]]
        );
        assert_eq!(
            serde_json::to_string(&answer).unwrap(),
            r#"{"columns":["a","b","c","d"],"rows":[[null,42,1.5,"text"]]}"#
        );
        for sql in ["SELECT x'00'", "SELECT 9e999", "SELECT CAST(x'ff' AS TEXT)"] {
            assert_eq!(
                select(&conn, sql, &[]).unwrap_err().code,
                DbErrorCode::UnsupportedValue,
                "{sql}"
            );
        }
    }
}
