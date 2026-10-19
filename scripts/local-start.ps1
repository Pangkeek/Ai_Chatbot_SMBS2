param(
  [switch]$SeedDemo
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

# เครื่องนี้มี Node 24 ที่ bundle ไว้; ใช้แทน Node รุ่นอื่นเมื่อจำเป็น
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
if (Test-Path (Join-Path $bundledNode 'node.exe')) {
  $env:PATH = "$bundledNode;$env:PATH"
}

function Invoke-Checked {
  param([string]$Label, [scriptblock]$Action)
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit $LASTEXITCODE)" }
}

function Invoke-NpmRun {
  param([string]$ScriptName, [string[]]$ExtraArgs = @())
  Invoke-Checked $ScriptName {
    & npm exec --yes --package=npm@11.19.0 -- npm run $ScriptName @ExtraArgs
  }
}

Invoke-NpmRun 'check:toolchain'

if (-not (Test-Path -LiteralPath '.env')) {
  Copy-Item -LiteralPath '.env.local.example' -Destination '.env'
}
$expectedUrl = 'DATABASE_URL=postgresql://chatbot:local-development-only@127.0.0.1:55434/chatbot_local'
if ((Get-Content -LiteralPath '.env') -notcontains $expectedUrl) {
  throw 'Existing .env points to another database. Review it manually before using the local starter.'
}

Invoke-Checked 'PostgreSQL startup' {
  & docker compose -f compose.local.yaml -p smb-chatbot-local up -d --wait
}
if (-not (Test-Path -LiteralPath 'node_modules/next')) {
  Invoke-Checked 'npm ci' {
    & npm exec --yes --package=npm@11.19.0 -- npm ci
  }
}
Invoke-NpmRun 'db:check:postgres'
Invoke-NpmRun 'db:migrate:postgres'
if ($SeedDemo) { Invoke-NpmRun 'db:seed' }

Write-Host 'Open http://127.0.0.1:3131'
Invoke-NpmRun 'dev' @('--', '--port', '3131')
