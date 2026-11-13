//! `origin-core` — the dependency-free OriginLabs ledger verifier.
//!
//! Usage:
//!   origin-core verify <ledger.jsonl>
//!   origin-core hash <file>
//!   origin-core canonical <file>
//!   origin-core build <body.json>
//!   origin-core selftest
//!   origin-core version
//!
//! `verify` exits non-zero if the chain is broken.

use std::env;
use std::fs;
use std::process::ExitCode;

fn read(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("{}: {}", path, e))
}

fn usage() -> String {
    [
        "origin-core 0.0.1 — portable OriginLabs ledger core",
        "",
        "Commands:",
        "  verify <ledger.jsonl>   verify the append-only hash chain",
        "  hash <file>             SHA-256 of a file's bytes",
        "  canonical <file>        canonical JSON of a file",
        "  build <body.json>       build a v1 event envelope",
        "  selftest                run built-in vectors",
        "  version                 print the core version",
    ]
    .join("\n")
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let cmd = args.first().map(String::as_str).unwrap_or("help");
    let result = match cmd {
        "verify" => {
            let Some(path) = args.get(1) else {
                return fail(usage());
            };
            match read(path) {
                Ok(ledger) => {
                    let result = origin_core::verify_jsonl(&ledger);
                    println!("{}", result);
                    if result.contains("\"ok\":true") {
                        ExitCode::SUCCESS
                    } else {
                        ExitCode::FAILURE
                    }
                }
                Err(e) => return fail(e),
            }
        }
        "hash" => {
            let Some(path) = args.get(1) else {
                return fail(usage());
            };
            match fs::read(path) {
                Ok(bytes) => {
                    println!("{}", origin_core::sha256_hex(&bytes));
                    ExitCode::SUCCESS
                }
                Err(e) => return fail(format!("{}: {}", path, e)),
            }
        }
        "canonical" => {
            let Some(path) = args.get(1) else {
                return fail(usage());
            };
            match read(path).and_then(|s| origin_core::canonicalize(&s).map_err(|e| e.to_string())) {
                Ok(v) => {
                    println!("{}", v);
                    ExitCode::SUCCESS
                }
                Err(e) => return fail(e),
            }
        }
        "build" => {
            let Some(path) = args.get(1) else {
                return fail(usage());
            };
            match read(path).and_then(|s| origin_core::build_event(&s)) {
                Ok(v) => {
                    println!("{}", v);
                    ExitCode::SUCCESS
                }
                Err(e) => return fail(e),
            }
        }
        "selftest" => {
            println!("{}", origin_core::self_test());
            ExitCode::SUCCESS
        }
        "version" => {
            println!("origin-core {}", origin_core::VERSION);
            ExitCode::SUCCESS
        }
        _ => fail(usage()),
    };
    result
}

fn fail(message: String) -> ExitCode {
    eprintln!("{}", message);
    ExitCode::FAILURE
}
