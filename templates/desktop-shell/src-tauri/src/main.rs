//! Entry point of the desktop shell. It only calls `run` in lib.rs.

// A release build on Windows opens no console window next to the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    wandit_desktop_shell::run();
}
