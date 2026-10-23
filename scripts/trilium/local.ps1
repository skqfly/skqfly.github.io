param([ValidateSet('seed', 'install-controls', 'preview', 'sync', 'queue')][string]$Action = 'preview')
$ErrorActionPreference = 'Stop'
# Reuse the locally configured credential without writing another token file.
$configPath = Join-Path $env:USERPROFILE '.codex\config.toml'
$config = [IO.File]::ReadAllText($configPath)
$section = [regex]::Match($config, '(?ms)^\[mcp_servers\.trilium\]\s*\r?\n(.*?)(?=^\[|\z)').Groups[1].Value
$token = [regex]::Match($section, 'Authorization\s*=\s*"Bearer ([^"]+)"').Groups[1].Value
if (!$token) { throw 'Trilium credential not found in the local Codex configuration.' }
$env:TRILIUM_ETAPI_TOKEN = $token
$env:TRILIUM_SERVER_URL = 'https://note.mmddskq.top'
$env:NODE_USE_ENV_PROXY = '1'
$scriptRoot = $PSScriptRoot
try {
  switch ($Action) {
    'preview' { node "$scriptRoot/sync.mjs" --dry-run }
    'sync' { node "$scriptRoot/sync.mjs" }
    default { node "$scriptRoot/$Action.mjs" }
  }
  if ($LASTEXITCODE -ne 0) { throw "Trilium command failed: $Action" }
} finally {
  Remove-Item Env:TRILIUM_ETAPI_TOKEN -ErrorAction SilentlyContinue
}
