#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cli="$root_dir/packages/form-assist/dist/cli/index.js"
if [[ ! -f "$cli" ]]; then
  echo 'Build the package first: npm run build' >&2
  exit 1
fi
if [[ -x "$root_dir/.tools/cargo/bin/cargo" ]]; then
  export CARGO_HOME="$root_dir/.tools/cargo" RUSTUP_HOME="$root_dir/.tools/rustup"
  export PATH="$CARGO_HOME/bin:$PATH"
fi
if [[ -x "$root_dir/.tools/dotnet/dotnet" ]]; then
  export DOTNET_ROOT="$root_dir/.tools/dotnet"
  export PATH="$DOTNET_ROOT:$PATH"
fi
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
command -v cargo >/dev/null || { echo 'cargo is required' >&2; exit 1; }
command -v dotnet >/dev/null || { echo 'dotnet is required' >&2; exit 1; }
(cd "$root_dir/examples/rust" && cargo run --quiet -- "$cli")
(cd "$root_dir/examples/csharp" && dotnet run -- "$cli")
