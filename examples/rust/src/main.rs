use std::{env, fs, io::{Read, Write}, process::{Command, Stdio}, thread, time::{Duration, Instant}};
use serde_json::Value;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = env::args().nth(1).unwrap_or_else(|| "../../packages/form-assist/dist/cli/index.js".into());
    let request: Value = serde_json::from_str(&fs::read_to_string("../../fixtures/cli/request.json")?)?;
    let expected: Value = serde_json::from_str(&fs::read_to_string("../../fixtures/cli/response.json")?)?;
    let mut child = Command::new("node").args([&cli, "propose", "--fixture", "demo", "--connection", "demo", "--model", "demo", "--stdin", "--json"]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
    let mut stdout = child.stdout.take().unwrap(); let mut stderr = child.stderr.take().unwrap();
    let out = thread::spawn(move || { let mut s = String::new(); stdout.read_to_string(&mut s).map(|_| s) });
    let err = thread::spawn(move || { let mut s = String::new(); stderr.read_to_string(&mut s).map(|_| s) });
    let mut input = child.stdin.take().unwrap();
    let writer = thread::spawn(move || write!(input, "{}", request));
    let deadline = Instant::now() + Duration::from_secs(10);
    let status = loop { if let Some(status) = child.try_wait()? { break status; } if Instant::now() >= deadline { child.kill()?; child.wait()?; return Err("CLI timed out".into()); } thread::sleep(Duration::from_millis(10)); };
    writer.join().map_err(|_| "stdin thread failed")??;
    let result = out.join().map_err(|_| "stdout thread failed")??; let errors = err.join().map_err(|_| "stderr thread failed")??;
    if !status.success() { return Err(format!("CLI failed: {errors}").into()); }
    let actual: Value = serde_json::from_str(&result)?; assert_eq!(actual, expected); println!("{actual}"); Ok(())
}
