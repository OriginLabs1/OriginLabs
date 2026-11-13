//! OriginLabs v0.0.1 portable ledger core.
//!
//! The trust-critical part of the lab is small on purpose:
//!
//! * canonical JSON (recursive key sorting, compact, deterministic),
//! * SHA-256 over the canonical event body,
//! * construction of the `origin.event/v1` envelope,
//! * full append-only chain verification, including the legacy genesis anchor.
//!
//! It has no runtime dependencies. The same code is compiled natively for the
//! `origin-core` CLI and to WebAssembly for the Android/PWA mobile surface, so
//! the phone, the browser and the desktop verify history with one implementation.

#![allow(static_mut_refs)]

use std::alloc::{alloc, dealloc, Layout};
use std::ptr;
use std::slice;

pub const VERSION: &str = "0.0.1";
pub const ZERO_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[derive(Clone, Debug, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(String),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

impl Json {
    fn as_obj(&self) -> Result<&[(String, Json)], String> {
        match self {
            Json::Obj(v) => Ok(v),
            _ => Err("expected a JSON object".to_string()),
        }
    }

    fn as_obj_mut(&mut self) -> Result<&mut Vec<(String, Json)>, String> {
        match self {
            Json::Obj(v) => Ok(v),
            _ => Err("expected a JSON object".to_string()),
        }
    }

    fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Obj(v) => v.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    fn as_str(&self) -> Result<&str, String> {
        match self {
            Json::Str(s) => Ok(s),
            _ => Err("expected a JSON string".to_string()),
        }
    }

    fn as_u64(&self) -> Result<u64, String> {
        match self {
            Json::Num(n) => n
                .parse::<u64>()
                .map_err(|_| "expected a non-negative integer".to_string()),
            _ => Err("expected a non-negative integer".to_string()),
        }
    }
}

struct Parser<'a> {
    s: &'a str,
    i: usize,
}

impl<'a> Parser<'a> {
    fn new(s: &'a str) -> Self {
        Self { s, i: 0 }
    }

    fn peek(&self) -> Option<u8> {
        self.s.as_bytes().get(self.i).copied()
    }

    fn bump(&mut self) -> Option<u8> {
        let b = self.peek()?;
        self.i += 1;
        Some(b)
    }

    fn skip_ws(&mut self) {
        while let Some(b) = self.peek() {
            if b == b' ' || b == b'\n' || b == b'\r' || b == b'\t' {
                self.i += 1;
            } else {
                break;
            }
        }
    }

    fn expect(&mut self, b: u8) -> Result<(), String> {
        if self.bump() == Some(b) {
            Ok(())
        } else {
            Err(format!("expected '{}' at byte {}", b as char, self.i.saturating_sub(1)))
        }
    }

    fn parse_value(&mut self) -> Result<Json, String> {
        self.skip_ws();
        match self.peek() {
            Some(b'{') => self.parse_object(),
            Some(b'[') => self.parse_array(),
            Some(b'"') => Ok(Json::Str(self.parse_string()?)),
            Some(b't') => {
                self.literal("true")?;
                Ok(Json::Bool(true))
            }
            Some(b'f') => {
                self.literal("false")?;
                Ok(Json::Bool(false))
            }
            Some(b'n') => {
                self.literal("null")?;
                Ok(Json::Null)
            }
            Some(b'-') | Some(b'0'..=b'9') => self.parse_number(),
            Some(_) => Err(format!("unexpected byte at {}", self.i)),
            None => Err("unexpected end of JSON".to_string()),
        }
    }

    fn literal(&mut self, lit: &str) -> Result<(), String> {
        if self.s[self.i..].starts_with(lit) {
            self.i += lit.len();
            Ok(())
        } else {
            Err(format!("expected '{}' at byte {}", lit, self.i))
        }
    }

    fn parse_object(&mut self) -> Result<Json, String> {
        self.expect(b'{')?;
        let mut out: Vec<(String, Json)> = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b'}') {
            self.i += 1;
            return Ok(Json::Obj(out));
        }
        loop {
            self.skip_ws();
            let key = self.parse_string()?;
            if out.iter().any(|(k, _)| k == &key) {
                return Err(format!("duplicate object key '{}'", key));
            }
            self.skip_ws();
            self.expect(b':')?;
            let value = self.parse_value()?;
            out.push((key, value));
            self.skip_ws();
            match self.bump() {
                Some(b',') => continue,
                Some(b'}') => break,
                _ => return Err("expected ',' or '}' in object".to_string()),
            }
        }
        Ok(Json::Obj(out))
    }

    fn parse_array(&mut self) -> Result<Json, String> {
        self.expect(b'[')?;
        let mut out = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b']') {
            self.i += 1;
            return Ok(Json::Arr(out));
        }
        loop {
            out.push(self.parse_value()?);
            self.skip_ws();
            match self.bump() {
                Some(b',') => continue,
                Some(b']') => break,
                _ => return Err("expected ',' or ']' in array".to_string()),
            }
        }
        Ok(Json::Arr(out))
    }

    fn parse_string(&mut self) -> Result<String, String> {
        self.expect(b'"')?;
        let mut out = String::new();
        loop {
            match self.peek() {
                Some(b'"') => {
                    self.i += 1;
                    return Ok(out);
                }
                Some(b'\\') => {
                    self.i += 1;
                    let esc = self.bump().ok_or("unterminated escape")?;
                    match esc {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{0008}'),
                        b'f' => out.push('\u{000c}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => {
                            let hi = self.hex4()?;
                            let cp = if (0xD800..=0xDBFF).contains(&hi) {
                                if self.bump() != Some(b'\\') || self.bump() != Some(b'u') {
                                    return Err("high surrogate without low surrogate".to_string());
                                }
                                let lo = self.hex4()?;
                                if !(0xDC00..=0xDFFF).contains(&lo) {
                                    return Err("invalid low surrogate".to_string());
                                }
                                0x10000 + (((hi as u32 - 0xD800) << 10) | (lo as u32 - 0xDC00))
                            } else if (0xDC00..=0xDFFF).contains(&hi) {
                                return Err("unexpected low surrogate".to_string());
                            } else {
                                hi as u32
                            };
                            out.push(char::from_u32(cp).ok_or("invalid unicode escape")?);
                        }
                        _ => return Err("invalid escape in string".to_string()),
                    }
                }
                Some(b) if b < 0x20 => return Err("control character in string".to_string()),
                Some(_) => {
                    let ch = self.s[self.i..]
                        .chars()
                        .next()
                        .ok_or("invalid UTF-8 in string")?;
                    out.push(ch);
                    self.i += ch.len_utf8();
                }
                None => return Err("unterminated string".to_string()),
            }
        }
    }

    fn hex4(&mut self) -> Result<u16, String> {
        let end = self.i + 4;
        if end > self.s.len() {
            return Err("short unicode escape".to_string());
        }
        let hex = &self.s[self.i..end];
        let n = u16::from_str_radix(hex, 16).map_err(|_| "invalid unicode escape".to_string())?;
        self.i = end;
        Ok(n)
    }

    fn parse_number(&mut self) -> Result<Json, String> {
        let start = self.i;
        if self.peek() == Some(b'-') {
            self.i += 1;
        }
        match self.peek() {
            Some(b'0') => {
                self.i += 1;
                if matches!(self.peek(), Some(b'0'..=b'9')) {
                    return Err("leading zero in number".to_string());
                }
            }
            Some(b'1'..=b'9') => {
                while matches!(self.peek(), Some(b'0'..=b'9')) {
                    self.i += 1;
                }
            }
            _ => return Err("invalid number".to_string()),
        }
        let mut is_int = true;
        if self.peek() == Some(b'.') {
            is_int = false;
            self.i += 1;
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return Err("digit expected after decimal point".to_string());
            }
            while matches!(self.peek(), Some(b'0'..=b'9')) {
                self.i += 1;
            }
        }
        if matches!(self.peek(), Some(b'e') | Some(b'E')) {
            is_int = false;
            self.i += 1;
            if matches!(self.peek(), Some(b'+') | Some(b'-')) {
                self.i += 1;
            }
            if !matches!(self.peek(), Some(b'0'..=b'9')) {
                return Err("digit expected in exponent".to_string());
            }
            while matches!(self.peek(), Some(b'0'..=b'9')) {
                self.i += 1;
            }
        }
        let raw = &self.s[start..self.i];
        if is_int {
            if let Ok(n) = raw.parse::<i128>() {
                return Ok(Json::Num(n.to_string()));
            }
        }
        let f = raw
            .parse::<f64>()
            .map_err(|_| format!("invalid number '{}'", raw))?;
        if !f.is_finite() {
            return Err("non-finite number".to_string());
        }
        Ok(Json::Num(format_f64(f)))
    }
}

fn format_f64(f: f64) -> String {
    if f == 0.0 {
        return "0".to_string();
    }
    // Rust's Display for f64 is the shortest round-tripping representation.
    // The app emits integers in ledger payloads; this path is for imported data.
    format!("{}", f)
}

pub fn parse_json(input: &str) -> Result<Json, String> {
    let mut p = Parser::new(input);
    p.skip_ws();
    let v = p.parse_value()?;
    p.skip_ws();
    if p.i != input.len() {
        return Err(format!("trailing data at byte {}", p.i));
    }
    Ok(v)
}

fn write_json_string(s: &str, out: &mut String) {
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{0008}' => out.push_str("\\b"),
            '\u{000c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

fn write_canonical(v: &Json, out: &mut String) {
    match v {
        Json::Null => out.push_str("null"),
        Json::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Json::Num(n) => out.push_str(n),
        Json::Str(s) => write_json_string(s, out),
        Json::Arr(a) => {
            out.push('[');
            for (i, item) in a.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_canonical(item, out);
            }
            out.push(']');
        }
        Json::Obj(o) => {
            let mut items: Vec<&(String, Json)> = o.iter().collect();
            items.sort_by(|a, b| a.0.cmp(&b.0));
            out.push('{');
            for (i, (k, val)) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write_json_string(k, out);
                out.push(':');
                write_canonical(val, out);
            }
            out.push('}');
        }
    }
}

pub fn canonicalize_json(v: &Json) -> String {
    let mut out = String::new();
    write_canonical(v, &mut out);
    out
}

pub fn canonicalize(input: &str) -> Result<String, String> {
    Ok(canonicalize_json(&parse_json(input)?))
}

pub fn sha256(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];

    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (i, item) in w.iter_mut().take(16).enumerate() {
            let j = i * 4;
            *item = u32::from_be_bytes([chunk[j], chunk[j + 1], chunk[j + 2], chunk[j + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7)
                ^ w[i - 15].rotate_right(18)
                ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17)
                ^ w[i - 2].rotate_right(19)
                ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }

        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

pub fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[(b >> 4) as usize] as char);
        out.push(DIGITS[(b & 0x0f) as usize] as char);
    }
    out
}

pub fn sha256_hex(data: &[u8]) -> String {
    hex(&sha256(data))
}

fn require_str<'a>(obj: &'a [(String, Json)], key: &str) -> Result<&'a str, String> {
    obj.iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v)
        .ok_or_else(|| format!("missing field '{}'", key))?
        .as_str()
}

fn require_u64(obj: &[(String, Json)], key: &str) -> Result<u64, String> {
    obj.iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v)
        .ok_or_else(|| format!("missing field '{}'", key))?
        .as_u64()
}

fn is_hash(value: &str) -> bool {
    let v = value.strip_prefix("sha256:").unwrap_or(value);
    v.len() == 64 && v.bytes().all(|b| b.is_ascii_hexdigit())
}

fn normalize_hash(value: &str) -> String {
    value
        .strip_prefix("sha256:")
        .unwrap_or(value)
        .to_ascii_lowercase()
}

fn event_body(obj: &[(String, Json)]) -> Result<Json, String> {
    let seq = require_u64(obj, "seq")?;
    if seq == 0 {
        return Err("seq must be >= 1".to_string());
    }
    let at = require_str(obj, "at")?;
    let typ = require_str(obj, "type")?;
    let actor = require_str(obj, "actor")?;
    let data_class = require_u64(obj, "dataClass")?;
    if data_class > 4 {
        return Err("dataClass must be 0-4".to_string());
    }
    let payload = obj
        .iter()
        .find(|(k, _)| k == "payload")
        .map(|(_, v)| v.clone())
        .ok_or("missing field 'payload'")?;
    if !matches!(payload, Json::Obj(_)) {
        return Err("payload must be a JSON object".to_string());
    }
    let prev = require_str(obj, "prev")?;
    if !is_hash(prev) {
        return Err("prev must be a 64-character hex hash".to_string());
    }
    Ok(Json::Obj(vec![
        ("schema".to_string(), Json::Str("origin.event/v1".to_string())),
        ("seq".to_string(), Json::Num(seq.to_string())),
        ("at".to_string(), Json::Str(at.to_string())),
        ("type".to_string(), Json::Str(typ.to_string())),
        ("actor".to_string(), Json::Str(actor.to_string())),
        ("dataClass".to_string(), Json::Num(data_class.to_string())),
        ("payload".to_string(), payload),
        ("prev".to_string(), Json::Str(normalize_hash(prev))),
    ]))
}

/// Build a complete `origin.event/v1` envelope from a body object.
///
/// Input keys: `seq`, `at`, `type`, `actor`, `dataClass`, `payload`, `prev`.
/// Output is canonical JSON with the computed `hash` included.
pub fn build_event(body_json: &str) -> Result<String, String> {
    let v = parse_json(body_json)?;
    let obj = v.as_obj()?;
    let body = event_body(obj)?;
    let canonical_body = canonicalize_json(&body);
    let hash = sha256_hex(canonical_body.as_bytes());
    let mut full = body;
    full.as_obj_mut()?.push(("hash".to_string(), Json::Str(hash)));
    Ok(canonicalize_json(&full))
}

fn break_obj(seq: Option<u64>, reason: &str, expected: &str, actual: &str) -> Json {
    Json::Obj(vec![
        (
            "seq".to_string(),
            match seq {
                Some(n) => Json::Num(n.to_string()),
                None => Json::Null,
            },
        ),
        ("reason".to_string(), Json::Str(reason.to_string())),
        ("expected".to_string(), Json::Str(expected.to_string())),
        ("actual".to_string(), Json::Str(actual.to_string())),
    ])
}

/// Verify a JSONL ledger. Returns the same result shape the mobile app and CLI use.
///
/// A legacy genesis event without `schema` is accepted as a trust anchor: chain
/// continuity is enforced, but its hash cannot be recomputed because the pre-v1
/// canonicalisation is unknown. It is reported in `legacy`.
pub fn verify_jsonl(input: &str) -> String {
    let mut events: u64 = 0;
    let mut expected_seq: u64 = 1;
    let mut prev_hash = ZERO_HASH.to_string();
    let mut head = ZERO_HASH.to_string();
    let mut legacy: Vec<Json> = Vec::new();
    let mut breaks: Vec<Json> = Vec::new();

    for (line_no, line) in input.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let v = match parse_json(line) {
            Ok(v) => v,
            Err(e) => {
                breaks.push(break_obj(
                    None,
                    &format!("line {} is not valid JSON: {}", line_no + 1, e),
                    "",
                    "",
                ));
                break;
            }
        };
        let obj = match v.as_obj() {
            Ok(o) => o,
            Err(e) => {
                breaks.push(break_obj(None, &e, "", ""));
                break;
            }
        };

        let seq = match require_u64(obj, "seq") {
            Ok(s) => s,
            Err(e) => {
                breaks.push(break_obj(None, &e, "", ""));
                break;
            }
        };
        if seq != expected_seq {
            breaks.push(break_obj(
                Some(seq),
                "sequence gap",
                &expected_seq.to_string(),
                &seq.to_string(),
            ));
            break;
        }

        let prev = match require_str(obj, "prev") {
            Ok(p) => normalize_hash(p),
            Err(e) => {
                breaks.push(break_obj(Some(seq), &e, "", ""));
                break;
            }
        };
        if prev != prev_hash {
            breaks.push(break_obj(Some(seq), "prev does not match the previous hash", &prev_hash, &prev));
            break;
        }

        let stored_hash = match require_str(obj, "hash") {
            Ok(h) => normalize_hash(h),
            Err(e) => {
                breaks.push(break_obj(Some(seq), &e, "", ""));
                break;
            }
        };

        let schema = obj
            .iter()
            .find(|(k, _)| k == "schema")
            .map(|(_, v)| v.as_str().unwrap_or(""));

        if schema == Some("origin.event/v1") {
            let body = match event_body(obj) {
                Ok(b) => b,
                Err(e) => {
                    breaks.push(break_obj(Some(seq), &e, "", stored_hash.as_str()));
                    break;
                }
            };
            let computed = sha256_hex(canonicalize_json(&body).as_bytes());
            if computed != stored_hash {
                breaks.push(break_obj(Some(seq), "hash mismatch", &computed, &stored_hash));
                break;
            }
        } else {
            // Pre-v1 genesis: continuity is checked, the hash is a legacy anchor.
            legacy.push(Json::Num(seq.to_string()));
        }

        head = stored_hash;
        prev_hash = head.clone();
        events += 1;
        expected_seq += 1;
    }

    let ok = breaks.is_empty() && events > 0;
    let result = Json::Obj(vec![
        ("schema".to_string(), Json::Str("origin.verify/v1".to_string())),
        ("ok".to_string(), Json::Bool(ok)),
        ("events".to_string(), Json::Num(events.to_string())),
        ("head".to_string(), Json::Str(head)),
        ("legacy".to_string(), Json::Arr(legacy)),
        ("breaks".to_string(), Json::Arr(breaks)),
    ]);
    canonicalize_json(&result)
}

/// Deterministic self-test used by the CLI and the mobile app's diagnostics.
pub fn self_test() -> String {
    let mut checks: Vec<Json> = Vec::new();
    let sha_ok = sha256_hex(b"abc")
        == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    checks.push(Json::Obj(vec![
        ("name".to_string(), Json::Str("sha256-abc".to_string())),
        ("ok".to_string(), Json::Bool(sha_ok)),
    ]));

    let canonical_ok = canonicalize(r#"{"b":2,"a":{"d":4,"c":3}}"#).as_deref()
        == Ok(r#"{"a":{"c":3,"d":4},"b":2}"#);
    checks.push(Json::Obj(vec![
        ("name".to_string(), Json::Str("canonical-json".to_string())),
        ("ok".to_string(), Json::Bool(canonical_ok)),
    ]));

    let body = r#"{"seq":1,"at":"2026-11-13T00:00:00.000Z","type":"workspace.created","actor":"principal","dataClass":0,"payload":{"name":"Test"},"prev":"0000000000000000000000000000000000000000000000000000000000000000"}"#;
    let build_ok = build_event(body).is_ok();
    checks.push(Json::Obj(vec![
        ("name".to_string(), Json::Str("build-event".to_string())),
        ("ok".to_string(), Json::Bool(build_ok)),
    ]));

    let all = checks.iter().all(|c| match c {
        Json::Obj(o) => o.iter().any(|(k, v)| k == "ok" && *v == Json::Bool(true)),
        _ => false,
    });
    let result = Json::Obj(vec![
        ("schema".to_string(), Json::Str("origin.selftest/v1".to_string())),
        ("version".to_string(), Json::Str(VERSION.to_string())),
        ("ok".to_string(), Json::Bool(all)),
        ("checks".to_string(), Json::Arr(checks)),
    ]);
    canonicalize_json(&result)
}

// ---------------------------------------------------------------------------
// WebAssembly ABI
// ---------------------------------------------------------------------------

static mut RESULT: Vec<u8> = Vec::new();

fn publish(value: String) -> *const u8 {
    unsafe {
        RESULT = value.into_bytes();
        RESULT.push(0);
        RESULT.as_ptr()
    }
}

#[no_mangle]
pub extern "C" fn origin_alloc(len: usize) -> *mut u8 {
    let size = len.max(1);
    match Layout::from_size_align(size, 1) {
        Ok(layout) => unsafe { alloc(layout) },
        Err(_) => ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn origin_free(ptr: *mut u8, len: usize) {
    if ptr.is_null() {
        return;
    }
    let size = len.max(1);
    if let Ok(layout) = Layout::from_size_align(size, 1) {
        unsafe { dealloc(ptr, layout) };
    }
}

#[no_mangle]
pub extern "C" fn origin_result_len() -> usize {
    unsafe { RESULT.len().saturating_sub(1) }
}

/// `origin_sha256_hex(ptr, len)` publishes the lowercase hex digest.
#[no_mangle]
pub extern "C" fn origin_sha256_hex(ptr: *const u8, len: usize) -> *const u8 {
    let data = unsafe { slice::from_raw_parts(ptr, len) };
    publish(sha256_hex(data))
}

/// `origin_canonicalize(ptr, len)` publishes canonical JSON or an error object.
#[no_mangle]
pub extern "C" fn origin_canonicalize(ptr: *const u8, len: usize) -> *const u8 {
    let data = unsafe { slice::from_raw_parts(ptr, len) };
    let text = match std::str::from_utf8(data) {
        Ok(t) => t,
        Err(_) => return publish(r#"{"error":"input is not UTF-8"}"#.to_string()),
    };
    match canonicalize(text) {
        Ok(v) => publish(v),
        Err(e) => publish(canonicalize_json(&Json::Obj(vec![(
            "error".to_string(),
            Json::Str(e),
        )]))),
    }
}

/// `origin_build_event(ptr, len)` publishes a complete event or an error object.
#[no_mangle]
pub extern "C" fn origin_build_event(ptr: *const u8, len: usize) -> *const u8 {
    let data = unsafe { slice::from_raw_parts(ptr, len) };
    let text = match std::str::from_utf8(data) {
        Ok(t) => t,
        Err(_) => return publish(r#"{"error":"input is not UTF-8"}"#.to_string()),
    };
    match build_event(text) {
        Ok(v) => publish(v),
        Err(e) => publish(canonicalize_json(&Json::Obj(vec![(
            "error".to_string(),
            Json::Str(e),
        )]))),
    }
}

/// `origin_verify(ptr, len)` accepts JSONL and publishes `origin.verify/v1`.
#[no_mangle]
pub extern "C" fn origin_verify(ptr: *const u8, len: usize) -> *const u8 {
    let data = unsafe { slice::from_raw_parts(ptr, len) };
    let text = match std::str::from_utf8(data) {
        Ok(t) => t,
        Err(_) => return publish(r#"{"ok":false,"breaks":[{"reason":"input is not UTF-8"}],"events":0}"#.to_string()),
    };
    publish(verify_jsonl(text))
}

#[no_mangle]
pub extern "C" fn origin_self_test() -> *const u8 {
    publish(self_test())
}

#[no_mangle]
pub extern "C" fn origin_version() -> *const u8 {
    static VERSION_BYTES: &[u8] = b"0.0.1\0";
    VERSION_BYTES.as_ptr()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_vectors() {
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            sha256_hex(b"hello\n"),
            "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"
        );
    }

    #[test]
    fn canonical_sorts_objects_recursively() {
        assert_eq!(
            canonicalize(r#"{"b":2,"a":{"d":4,"c":3},"e":[{"z":1,"a":2}]}"#).unwrap(),
            r#"{"a":{"c":3,"d":4},"b":2,"e":[{"a":2,"z":1}]}"#
        );
    }

    #[test]
    fn canonical_strings_and_unicode() {
        assert_eq!(
            canonicalize(r#"{"s":"a\"b\\c\n\u00e9"}"#).unwrap(),
            "{\"s\":\"a\\\"b\\\\c\\né\"}"
        );
    }

    #[test]
    fn rejects_duplicate_keys_and_non_finite() {
        assert!(canonicalize(r#"{"a":1,"a":2}"#).is_err());
        assert!(canonicalize(r#"{"a":1e999}"#).is_err());
    }

    #[test]
    fn builds_and_verifies_an_event() {
        let body = r#"{"seq":1,"at":"2026-11-13T00:00:00.000Z","type":"workspace.created","actor":"principal","dataClass":0,"payload":{"name":"Test","count":2},"prev":"0000000000000000000000000000000000000000000000000000000000000000"}"#;
        let event = build_event(body).unwrap();
        assert!(event.contains("\"hash\":\""));
        let ledger = format!("{}\n", event);
        let result = verify_jsonl(&ledger);
        assert!(result.contains("\"ok\":true"), "{}", result);
        assert!(result.contains("\"events\":1"), "{}", result);
    }

    #[test]
    fn detects_tampering_at_the_right_sequence() {
        let body = r#"{"seq":1,"at":"2026-11-13T00:00:00.000Z","type":"workspace.created","actor":"principal","dataClass":0,"payload":{"name":"Test"},"prev":"0000000000000000000000000000000000000000000000000000000000000000"}"#;
        let event = build_event(body).unwrap();
        let tampered = event.replace("\"Test\"", "\"Tampered\"");
        let result = verify_jsonl(&format!("{}\n", tampered));
        assert!(result.contains("\"ok\":false"), "{}", result);
        assert!(result.contains("\"seq\":1"), "{}", result);
        assert!(result.contains("hash mismatch"), "{}", result);
    }

    #[test]
    fn verifies_the_repository_ledger_when_present() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../.origin/events.jsonl");
        if let Ok(ledger) = std::fs::read_to_string(path) {
            let result = verify_jsonl(&ledger);
            assert!(result.contains("\"ok\":true"), "{}", result);
            assert!(result.contains("\"legacy\":[1]"), "{}", result);
        }
    }
}
