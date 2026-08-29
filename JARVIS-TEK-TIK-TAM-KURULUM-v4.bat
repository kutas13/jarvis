@echo off
setlocal EnableExtensions
title JARVIS - TEK TIK KURULUM + GITHUB + RENDER + WINDOWS AGENT
set "JARVIS_SELF=%~f0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p=$env:JARVIS_SELF; $lines=Get-Content -LiteralPath $p; $m=[Array]::IndexOf($lines,'#--JARVIS-POWERSHELL--'); if($m -lt 0){throw 'PowerShell bolumu bulunamadi'}; $code=($lines[($m+1)..($lines.Length-1)] -join [Environment]::NewLine); Invoke-Expression $code"

set "EC=%ERRORLEVEL%"
echo.
if not "%EC%"=="0" (
  echo ============================================
  echo   JARVIS KURULUMU HATA ILE DURDU
  echo ============================================
  echo Yukaridaki son hata satirini ChatGPT'ye gonder.
) else (
  echo ============================================
  echo   JARVIS TAMAMLANDI
  echo ============================================
)
echo.
pause
exit /b %EC%

#--JARVIS-POWERSHELL--
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# -------------------- SABITLER --------------------
$RepoUrl       = 'https://github.com/kutas13/jarvis.git'
$ProductionUrl = 'https://jarvis-emym.onrender.com'
$RenderService = 'srv-da9dtm142hec73fk0pug'
$DeviceName    = 'Furkan-PC'

function Step([string]$Text) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkCyan
}

function Fail([string]$Message) {
    throw $Message
}

function New-RandomHex([int]$Bytes = 32) {
    $b = New-Object byte[] $Bytes
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    return ([BitConverter]::ToString($b) -replace '-', '').ToLowerInvariant()
}

function Plain-Secure([Security.SecureString]$Secure) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-Secret([string]$Prompt) {
    return Plain-Secure (Read-Host $Prompt -AsSecureString)
}

function Read-DotEnv([string]$Path) {
    $h = @{}
    if (!(Test-Path -LiteralPath $Path)) { return $h }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $t = $line.Trim()
        if (!$t -or $t.StartsWith('#') -or !$t.Contains('=')) { continue }
        $i = $t.IndexOf('=')
        $k = $t.Substring(0,$i).Trim()
        $v = $t.Substring($i+1).Trim()
        if ($k) { $h[$k] = $v }
    }
    return $h
}

function Save-DotEnv([string]$Path, [hashtable]$EnvMap) {
    $ordered = @(
        'OPENAI_API_KEY',
        'OPENAI_MODEL_ECONOMY',
        'OPENAI_MODEL_SMART',
        'OPENAI_MODEL_VISION',
        'OPENAI_TRANSCRIBE_MODEL',
        'OPENAI_TTS_MODEL',
        'OPENAI_TTS_VOICE',
        'NEXT_PUBLIC_PREMIUM_TTS',
        'JARVIS_MODEL_MODE',
        'JARVIS_DAILY_BUDGET_USD',
        'JARVIS_MONTHLY_BUDGET_USD',
        'OPENAI_ECONOMY_INPUT_USD_PER_MTOK',
        'OPENAI_ECONOMY_OUTPUT_USD_PER_MTOK',
        'OPENAI_SMART_INPUT_USD_PER_MTOK',
        'OPENAI_SMART_OUTPUT_USD_PER_MTOK',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'JARVIS_OWNER_ID',
        'JARVIS_ACCESS_KEY',
        'JARVIS_PAIRING_SECRET',
        'NEXT_PUBLIC_APP_URL',
        'JARVIS_TIMEZONE',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI',
        'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
        'VAPID_PRIVATE_KEY',
        'VAPID_SUBJECT',
        'CRON_SECRET',
        'HOME_ASSISTANT_URL',
        'HOME_ASSISTANT_TOKEN',
        'HOME_ASSISTANT_ALLOWLIST'
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('# JARVIS local secrets - GITHUBA GITMEZ')
    foreach ($k in $ordered) {
        if ($EnvMap.ContainsKey($k)) {
            $lines.Add("$k=$($EnvMap[$k])")
        }
    }
    Set-Content -LiteralPath $Path -Value $lines -Encoding UTF8
}

function Ensure-GitIgnore([string]$Repo) {
    $p = Join-Path $Repo '.gitignore'
    $rules = @(
        '.env',
        '.env.local',
        '.env.*.local',
        '.render-api-key.local',
        'JARVIS-LOCAL-SECRETS.txt',
        'windows-agent/.env',
        'windows-agent/logs/',
        'windows-agent/.venv/',
        'node_modules/',
        '.next/',
        '*.tsbuildinfo',
        '*.log',
        'JARVIS-MORNING.ps1',
        'JARVIS-EVENING.ps1'
    )
    $current = if (Test-Path $p) { @(Get-Content $p) } else { @() }
    foreach ($r in $rules) {
        if ($current -notcontains $r) {
            Add-Content -LiteralPath $p -Value $r
            $current += $r
        }
    }
}

function Invoke-Exe([string]$Exe, [string[]]$ArgumentList, [string]$ErrorText) {
    & $Exe @ArgumentList
    if ($LASTEXITCODE -ne 0) { Fail "$ErrorText (exit $LASTEXITCODE)" }
}

function Render-Headers([string]$Token) {
    return @{
        Authorization = "Bearer $Token"
        Accept        = 'application/json'
    }
}

function Set-RenderEnv([string]$Token, [string]$Key, [string]$Value) {
    $uri = "https://api.render.com/v1/services/$RenderService/env-vars/$Key"
    $body = @{ value = [string]$Value } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Put -Uri $uri -Headers (Render-Headers $Token) -ContentType 'application/json' -Body $body | Out-Null
    Write-Host "Render ENV: $Key = OK" -ForegroundColor DarkGreen
}

function Write-KnownFixes([string]$Repo) {
    $healthPath = Join-Path $Repo 'app\api\health\route.ts'
    New-Item -ItemType Directory -Force (Split-Path $healthPath) | Out-Null
    @'
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REQUIRED_ENV = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JARVIS_OWNER_ID',
  'JARVIS_ACCESS_KEY',
  'JARVIS_PAIRING_SECRET'
] as const;

export async function GET() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());

  return NextResponse.json(
    {
      ok: missing.length === 0,
      service: 'JARVIS',
      time: new Date().toISOString(),
      environment: process.env.RENDER ? 'render' : process.env.NODE_ENV || 'unknown',
      missing_env: missing
    },
    { status: missing.length === 0 ? 200 : 503 }
  );
}
'@ | Set-Content -LiteralPath $healthPath -Encoding UTF8

    $pairPath = Join-Path $Repo 'app\api\agent\pair\route.ts'
    New-Item -ItemType Directory -Force (Split-Path $pairPath) | Out-Null
    @'
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, ownerId } from '@/lib/db';
import { constantTimeEqual, randomToken, sha256 } from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const expected = process.env.JARVIS_PAIRING_SECRET?.trim();

    if (!expected) {
      return NextResponse.json(
        {
          error: 'JARVIS_PAIRING_SECRET sunucuda tanimli degil.',
          hint: 'Render Environment bolumune JARVIS_PAIRING_SECRET eklenmeli.'
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const secret = String(body?.pairing_secret || '');
    const name = String(body?.name || 'Windows PC').slice(0, 80);

    if (!constantTimeEqual(secret, expected)) {
      return NextResponse.json({ error: 'Eslestirme anahtari gecersiz.' }, { status: 401 });
    }

    const token = randomToken(32);
    const db = adminDb();

    const { data, error } = await db
      .from('devices')
      .insert({
        user_id: ownerId(),
        name,
        token_hash: sha256(token),
        enabled: true,
        last_seen_at: new Date().toISOString()
      })
      .select('id,name')
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      device: data,
      device_token: token
    });
  } catch (e:any) {
    return NextResponse.json(
      { error: e.message || 'Eslestirme hatasi' },
      { status: 500 }
    );
  }
}
'@ | Set-Content -LiteralPath $pairPath -Encoding UTF8

    $renderPath = Join-Path $Repo 'render.yaml'
    @"
services:
  - type: web
    name: jarvis
    runtime: node
    plan: free
    autoDeploy: true
    buildCommand: npm ci && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
"@ | Set-Content -LiteralPath $renderPath -Encoding UTF8

    $cursorIgnore = Join-Path $Repo '.cursorignore'
    @'
node_modules
.next
.git
windows-agent/.venv
windows-agent/logs
*.tsbuildinfo
'@ | Set-Content -LiteralPath $cursorIgnore -Encoding UTF8
}

# -------------------- PROJEYI BUL / KLONLA --------------------
Step '1/12 - JARVIS PROJESI HAZIRLANIYOR'

$ScriptDir = Split-Path -Parent $env:JARVIS_SELF
$Repo = $null

if (Test-Path (Join-Path $ScriptDir 'package.json')) {
    $Repo = $ScriptDir
} else {
    $child = Get-ChildItem -LiteralPath $ScriptDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } |
        Select-Object -First 1
    if ($child) { $Repo = $child.FullName }
}

if (!$Repo) {
    $Desktop = [Environment]::GetFolderPath('Desktop')
    $Repo = Join-Path $Desktop 'JARVIS-LIVE'
    if (Test-Path $Repo) {
        Write-Host "Eski JARVIS-LIVE klasoru kullaniliyor: $Repo"
    } else {
        Write-Host "GitHub'dan temiz proje klonlaniyor..."
        Invoke-Exe 'git' @('clone',$RepoUrl,$Repo) 'Git clone basarisiz'
    }
}

Set-Location $Repo
Write-Host "Proje: $Repo" -ForegroundColor Green

if (!(Test-Path 'package.json')) { Fail 'package.json bulunamadi.' }

Ensure-GitIgnore $Repo
Write-KnownFixes $Repo

# -------------------- ENV / SECRETLER --------------------
Step '2/12 - GIZLI AYARLAR HAZIRLANIYOR'

$EnvPath = Join-Path $Repo '.env.local'
$e = Read-DotEnv $EnvPath

if (!$e['OPENAI_API_KEY']) {
    $e['OPENAI_API_KEY'] = Read-Secret 'OpenAI API Key (sk-...)'
}
if (!$e['OPENAI_API_KEY']) { Fail 'OPENAI_API_KEY gerekli.' }

if (!$e['SUPABASE_URL']) {
    $e['SUPABASE_URL'] = (Read-Host 'Supabase Project URL (https://....supabase.co)').Trim()
}
if (!$e['SUPABASE_SERVICE_ROLE_KEY']) {
    $e['SUPABASE_SERVICE_ROLE_KEY'] = Read-Secret 'Supabase SERVICE ROLE key'
}
if (!$e['SUPABASE_URL'] -or !$e['SUPABASE_SERVICE_ROLE_KEY']) {
    Fail 'Supabase URL ve Service Role Key gerekli.'
}

if (!$e['JARVIS_OWNER_ID'])        { $e['JARVIS_OWNER_ID'] = [guid]::NewGuid().ToString() }
if (!$e['JARVIS_ACCESS_KEY'])      { $e['JARVIS_ACCESS_KEY'] = New-RandomHex 24 }
if (!$e['JARVIS_PAIRING_SECRET'])  { $e['JARVIS_PAIRING_SECRET'] = New-RandomHex 32 }
if (!$e['CRON_SECRET'])             { $e['CRON_SECRET'] = New-RandomHex 32 }

# Cost-first current model routing
$e['OPENAI_MODEL_ECONOMY'] = 'gpt-5-mini'
$e['OPENAI_MODEL_SMART']   = 'gpt-5.4-mini'
$e['OPENAI_MODEL_VISION']  = 'gpt-5.4-mini'
$e['OPENAI_TRANSCRIBE_MODEL'] = 'gpt-4o-mini-transcribe'
$e['OPENAI_TTS_MODEL'] = 'gpt-4o-mini-tts'
$e['OPENAI_TTS_VOICE'] = 'alloy'
$e['NEXT_PUBLIC_PREMIUM_TTS'] = 'false'
$e['JARVIS_MODEL_MODE'] = 'AUTO'
$e['JARVIS_DAILY_BUDGET_USD'] = '0.50'
$e['JARVIS_MONTHLY_BUDGET_USD'] = '10'
$e['OPENAI_ECONOMY_INPUT_USD_PER_MTOK'] = '0.20'
$e['OPENAI_ECONOMY_OUTPUT_USD_PER_MTOK'] = '1.20'
$e['OPENAI_SMART_INPUT_USD_PER_MTOK'] = '2'
$e['OPENAI_SMART_OUTPUT_USD_PER_MTOK'] = '12'
$e['NEXT_PUBLIC_APP_URL'] = $ProductionUrl
$e['JARVIS_TIMEZONE'] = 'Europe/Istanbul'
$e['GOOGLE_REDIRECT_URI'] = "$ProductionUrl/api/integrations/google/callback"
if (!$e['VAPID_SUBJECT']) { $e['VAPID_SUBJECT'] = 'mailto:jarvis@example.com' }
if (!$e['HOME_ASSISTANT_ALLOWLIST']) { $e['HOME_ASSISTANT_ALLOWLIST'] = 'light.,switch.' }

Save-DotEnv $EnvPath $e
Write-Host ".env.local hazir." -ForegroundColor Green

# Render API token localde saklanir, gitignore'dadir.
$RenderTokenPath = Join-Path $Repo '.render-api-key.local'
$RenderToken = if (Test-Path $RenderTokenPath) { (Get-Content $RenderTokenPath -Raw).Trim() } else { '' }
if (!$RenderToken) {
    Write-Host ""
    Write-Host 'Render API Key gerekiyor. Render > Account Settings > API Keys bolumunden bir kez olustur.' -ForegroundColor Yellow
    $RenderToken = Read-Secret 'Render API Key'
    if (!$RenderToken) { Fail 'Render API Key gerekli.' }
    Set-Content -LiteralPath $RenderTokenPath -Value $RenderToken -NoNewline -Encoding ASCII
}

# Render tokenu dogrula
try {
    Invoke-RestMethod -Method Get -Uri "https://api.render.com/v1/services/$RenderService" -Headers (Render-Headers $RenderToken) | Out-Null
    Write-Host "Render API baglantisi OK." -ForegroundColor Green
} catch {
    Remove-Item $RenderTokenPath -Force -ErrorAction SilentlyContinue
    Fail "Render API Key gecersiz veya servis yetkisi yok: $($_.Exception.Message)"
}

# -------------------- LOCAL NODE ISLEMLERI ATLA --------------------
Step '3/12 - LOCAL NODE/RAM ISLEMLERI ATLANIYOR'
Write-Host 'Bu bilgisayarda Node/npm OOM sorunu var.' -ForegroundColor Yellow
Write-Host 'npm ci, typecheck ve next build LOCALDE calistirilmayacak.' -ForegroundColor Yellow
Write-Host 'Production npm ci + next build Render sunucusunda yapilacak.' -ForegroundColor Green

# VAPID anahtarlarini npm kullanmadan .NET ECDSA P-256 ile olustur.
if (!$e['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] -or !$e['VAPID_PRIVATE_KEY']) {
    try {
        $curve = [System.Security.Cryptography.ECCurve]::NamedCurves.nistP256
        $ecdsa = [System.Security.Cryptography.ECDsa]::Create($curve)
        $p = $ecdsa.ExportParameters($true)

        $pub = New-Object byte[] 65
        $pub[0] = 4
        [Array]::Copy($p.Q.X, 0, $pub, 1, 32)
        [Array]::Copy($p.Q.Y, 0, $pub, 33, 32)

        function To-B64Url([byte[]]$Bytes) {
            return ([Convert]::ToBase64String($Bytes)).TrimEnd('=').Replace('+','-').Replace('/','_')
        }

        $e['NEXT_PUBLIC_VAPID_PUBLIC_KEY'] = To-B64Url $pub
        $e['VAPID_PRIVATE_KEY'] = To-B64Url $p.D
        Save-DotEnv $EnvPath $e
        Write-Host 'Web Push VAPID anahtarlari npm kullanmadan olusturuldu.' -ForegroundColor Green
        $ecdsa.Dispose()
    } catch {
        Write-Host "VAPID otomatik olusturulamadi: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host 'Push bildirimleri haric sistem deploy edilmeye devam edecek.' -ForegroundColor Yellow
    }
}

Step '4/12 - KOD KONTROLU RENDER BUILD ILE YAPILACAK'
Write-Host 'Yerel RAM sorunu nedeniyle kod kontrolu Render production build sonucuyla dogrulanacak.' -ForegroundColor Green

Step '5/12 - PRODUCTION BUILD RENDERDA YAPILACAK'
Write-Host 'Local build yok. GitHub push sonrasi Render npm ci && npm run build calistiracak.' -ForegroundColor Green

# -------------------- GIT --------------------
Step '6/12 - GITHUB GUNCELLENIYOR'
if (!(Test-Path '.git')) {
    Invoke-Exe 'git' @('init') 'git init basarisiz'
}
& git branch -M main | Out-Null

$remote = (& git remote get-url origin 2>$null)
if (!$remote) {
    Invoke-Exe 'git' @('remote','add','origin',$RepoUrl) 'Git remote eklenemedi'
} elseif ($remote.Trim() -ne $RepoUrl) {
    Invoke-Exe 'git' @('remote','set-url','origin',$RepoUrl) 'Git remote duzeltilemedi'
}

# Git kimligi yoksa lokal kimlik koy
$name = (& git config user.name 2>$null)
$mail = (& git config user.email 2>$null)
if (!$name) { & git config user.name 'JARVIS Deploy' | Out-Null }
if (!$mail) { & git config user.email 'jarvis-deploy@local' | Out-Null }

# Secret/build dosyalari asla track edilmesin
& git rm --cached --ignore-unmatch .env .env.local .render-api-key.local 'windows-agent/.env' 'JARVIS-LOCAL-SECRETS.txt' 2>$null | Out-Null
& git rm -r --cached --ignore-unmatch node_modules .next 'windows-agent/.venv' 2>$null | Out-Null
& git add -A

$hasChanges = $true
& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) { $hasChanges = $false }

if ($hasChanges) {
    Invoke-Exe 'git' @('commit','-m','JARVIS one-click production deployment') 'Git commit basarisiz'
} else {
    Write-Host 'Yeni commit gerektiren degisiklik yok.'
}

# Normal push, gerekirse guvenli force-with-lease
& git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Normal push reddedildi; remote kontrol edilip force-with-lease deneniyor...' -ForegroundColor Yellow
    & git fetch origin main
    if ($LASTEXITCODE -ne 0) { Fail 'git fetch basarisiz' }
    & git push -u origin main --force-with-lease
    if ($LASTEXITCODE -ne 0) { Fail 'GitHub push basarisiz' }
}
$CommitSha = (& git rev-parse HEAD).Trim()
Write-Host "GitHub OK: $CommitSha" -ForegroundColor Green

# -------------------- RENDER SERVICE CONFIG --------------------
Step '6.5/12 - RENDER BUILD AYARLARI KONTROL EDILIYOR'
try {
    $patchBody = @{
        autoDeploy = 'yes'
        branch = 'main'
        serviceDetails = @{
            buildCommand = 'npm ci && npm run build'
            startCommand = 'npm start'
        }
    } | ConvertTo-Json -Depth 5 -Compress

    Invoke-RestMethod -Method Patch `
        -Uri "https://api.render.com/v1/services/$RenderService" `
        -Headers (Render-Headers $RenderToken) `
        -ContentType 'application/json' `
        -Body $patchBody | Out-Null
    Write-Host 'Render service ayarlari guncellendi.' -ForegroundColor Green
} catch {
    Write-Host "Render service config API atlandi: $($_.Exception.Message)" -ForegroundColor DarkYellow
    Write-Host 'Mevcut Render build/start ayarlari kullanilacak.' -ForegroundColor DarkYellow
}

# -------------------- RENDER ENV --------------------
Step '7/12 - RENDER ENVIRONMENT VARIABLES YAZILIYOR'

$renderEnv = [ordered]@{
    OPENAI_API_KEY                         = $e['OPENAI_API_KEY']
    OPENAI_MODEL_ECONOMY                   = $e['OPENAI_MODEL_ECONOMY']
    OPENAI_MODEL_SMART                     = $e['OPENAI_MODEL_SMART']
    OPENAI_MODEL_VISION                    = $e['OPENAI_MODEL_VISION']
    OPENAI_TRANSCRIBE_MODEL                = $e['OPENAI_TRANSCRIBE_MODEL']
    OPENAI_TTS_MODEL                       = $e['OPENAI_TTS_MODEL']
    OPENAI_TTS_VOICE                       = $e['OPENAI_TTS_VOICE']
    NEXT_PUBLIC_PREMIUM_TTS                = $e['NEXT_PUBLIC_PREMIUM_TTS']
    JARVIS_MODEL_MODE                      = $e['JARVIS_MODEL_MODE']
    JARVIS_DAILY_BUDGET_USD                = $e['JARVIS_DAILY_BUDGET_USD']
    JARVIS_MONTHLY_BUDGET_USD              = $e['JARVIS_MONTHLY_BUDGET_USD']
    OPENAI_ECONOMY_INPUT_USD_PER_MTOK      = $e['OPENAI_ECONOMY_INPUT_USD_PER_MTOK']
    OPENAI_ECONOMY_OUTPUT_USD_PER_MTOK     = $e['OPENAI_ECONOMY_OUTPUT_USD_PER_MTOK']
    OPENAI_SMART_INPUT_USD_PER_MTOK        = $e['OPENAI_SMART_INPUT_USD_PER_MTOK']
    OPENAI_SMART_OUTPUT_USD_PER_MTOK       = $e['OPENAI_SMART_OUTPUT_USD_PER_MTOK']
    SUPABASE_URL                           = $e['SUPABASE_URL']
    SUPABASE_SERVICE_ROLE_KEY              = $e['SUPABASE_SERVICE_ROLE_KEY']
    JARVIS_OWNER_ID                        = $e['JARVIS_OWNER_ID']
    JARVIS_ACCESS_KEY                      = $e['JARVIS_ACCESS_KEY']
    JARVIS_PAIRING_SECRET                  = $e['JARVIS_PAIRING_SECRET']
    NEXT_PUBLIC_APP_URL                    = $ProductionUrl
    JARVIS_TIMEZONE                        = 'Europe/Istanbul'
    NODE_OPTIONS                           = '--max-old-space-size=2048'
    NEXT_TELEMETRY_DISABLED                = '1'
    GOOGLE_REDIRECT_URI                    = "$ProductionUrl/api/integrations/google/callback"
    CRON_SECRET                            = $e['CRON_SECRET']
    HOME_ASSISTANT_ALLOWLIST               = $e['HOME_ASSISTANT_ALLOWLIST']
}

foreach ($optional in @(
    'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT',
    'HOME_ASSISTANT_URL','HOME_ASSISTANT_TOKEN'
)) {
    if ($e[$optional]) { $renderEnv[$optional] = $e[$optional] }
}

foreach ($kv in $renderEnv.GetEnumerator()) {
    Set-RenderEnv $RenderToken $kv.Key ([string]$kv.Value)
}

# -------------------- DEPLOY --------------------
Step '8/12 - RENDER DEPLOY BASLATILIYOR'
$deployBody = @{
    clearCache = 'clear'
    commitId   = $CommitSha
} | ConvertTo-Json -Compress

try {
    $deploy = Invoke-RestMethod -Method Post `
        -Uri "https://api.render.com/v1/services/$RenderService/deploys" `
        -Headers (Render-Headers $RenderToken) `
        -ContentType 'application/json' `
        -Body $deployBody
    Write-Host "Deploy baslatildi." -ForegroundColor Green
} catch {
    Fail "Render deploy baslatilamadi: $($_.Exception.Message)"
}

# -------------------- CANLI HEALTH POLL --------------------
Step '9/12 - RENDER BUILD + CANLI SITE BEKLENIYOR'
$deadline = (Get-Date).AddMinutes(15)
$healthy = $false
$lastErr = ''
$deployId = ''
try {
    if ($deploy.id) { $deployId = [string]$deploy.id }
    elseif ($deploy.deploy.id) { $deployId = [string]$deploy.deploy.id }
} catch {}

while ((Get-Date) -lt $deadline) {
    if ($deployId) {
        try {
            $d = Invoke-RestMethod -Method Get -Uri "https://api.render.com/v1/services/$RenderService/deploys/$deployId" -Headers (Render-Headers $RenderToken)
            $status = if ($d.status) { [string]$d.status } elseif ($d.deploy.status) { [string]$d.deploy.status } else { '' }
            if ($status) { Write-Host "Render deploy: $status" }
            if ($status -match 'build_failed|update_failed|canceled|deactivated') {
                Fail "Render deploy basarisiz: $status. Render Logs ekranini kontrol et."
            }
        } catch {
            Write-Host "Render deploy durumu gecici okunamadi." -ForegroundColor DarkYellow
        }
    }

    try {
        $h = Invoke-RestMethod -Method Get -Uri "$ProductionUrl/api/health" -TimeoutSec 25
        if ($h.ok -eq $true) {
            $healthy = $true
            Write-Host 'JARVIS HEALTH: OK' -ForegroundColor Green
            break
        } else {
            $lastErr = "missing_env: $($h.missing_env -join ', ')"
        }
    } catch {
        $lastErr = $_.Exception.Message
    }

    Write-Host "Site hazirlaniyor... $lastErr"
    Start-Sleep -Seconds 12
}

if (!$healthy) {
    Fail "Site 15 dakika icinde saglikli olmadi. Son durum: $lastErr"
}

# -------------------- WINDOWS AGENT --------------------
Step '10/12 - WINDOWS AGENT ESLESTIRILIYOR'

$AgentDir = Join-Path $Repo 'windows-agent'
if (!(Test-Path (Join-Path $AgentDir 'agent.py'))) {
    Fail 'windows-agent/agent.py bulunamadi.'
}

# Agent dependency kurulumu
$installBat = Join-Path $AgentDir 'install.bat'
if (Test-Path $installBat) {
    Push-Location $AgentDir
    & cmd.exe /c install.bat
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Fail 'Windows Agent install.bat basarisiz'
    }
    Pop-Location
}

# Server ile direkt pairing yap
try {
    $pairBody = @{
        pairing_secret = $e['JARVIS_PAIRING_SECRET']
        name           = $DeviceName
    } | ConvertTo-Json -Compress

    $paired = Invoke-RestMethod -Method Post `
        -Uri "$ProductionUrl/api/agent/pair" `
        -ContentType 'application/json' `
        -Body $pairBody `
        -TimeoutSec 30

    $DeviceToken = [string]$paired.device_token
    if (!$DeviceToken) { Fail 'Server device_token dondurmedi.' }
} catch {
    Fail "Windows Agent pairing basarisiz: $($_.Exception.Message)"
}

$AgentEnv = @"
JARVIS_URL=$ProductionUrl
JARVIS_PAIRING_SECRET=$($e['JARVIS_PAIRING_SECRET'])
JARVIS_DEVICE_TOKEN=$DeviceToken
DEVICE_NAME=$DeviceName
POLL_SECONDS=2
INDEX_ROOTS=%USERPROFILE%\\Documents;%USERPROFILE%\\Desktop;%USERPROFILE%\\Downloads
INDEX_INTERVAL_SECONDS=600
MAX_INDEX_FILES=1200
ENABLE_DESKTOP_AUTOMATION=true
"@
Set-Content -LiteralPath (Join-Path $AgentDir '.env') -Value $AgentEnv -Encoding ASCII
Write-Host 'Windows Agent .env production icin hazir.' -ForegroundColor Green

# Background servisi yeniden kur
$uninstall = Join-Path $AgentDir 'uninstall-background.bat'
$installBg = Join-Path $AgentDir 'install-background.bat'

if (Test-Path $uninstall) {
    Push-Location $AgentDir
    & cmd.exe /c uninstall-background.bat | Out-Host
    Pop-Location
}
if (Test-Path $installBg) {
    Push-Location $AgentDir
    & cmd.exe /c install-background.bat | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Fail 'Background Agent kurulumu basarisiz'
    }
    Pop-Location
}

Start-Sleep -Seconds 8

# -------------------- SABAH / AKSAM WINDOWS TASK --------------------
Step '11/12 - 09:30 SABAH VE 19:00 AKSAM RUTINLERI KURULUYOR'

$MorningPs = Join-Path $Repo 'JARVIS-MORNING.ps1'
$EveningPs = Join-Path $Repo 'JARVIS-EVENING.ps1'

@"
`$ErrorActionPreference='SilentlyContinue'
Invoke-RestMethod -Method Get -Uri '$ProductionUrl/api/cron/morning' -Headers @{Authorization='Bearer $($e['CRON_SECRET'])'} -TimeoutSec 60 | Out-Null
"@ | Set-Content -LiteralPath $MorningPs -Encoding UTF8

@"
`$ErrorActionPreference='SilentlyContinue'
Invoke-RestMethod -Method Get -Uri '$ProductionUrl/api/cron/evening' -Headers @{Authorization='Bearer $($e['CRON_SECRET'])'} -TimeoutSec 60 | Out-Null
"@ | Set-Content -LiteralPath $EveningPs -Encoding UTF8

$morningTR = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$MorningPs`""
$eveningTR = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$EveningPs`""

& schtasks.exe /Create /F /SC DAILY /ST 09:30 /TN "JARVIS Morning Routine" /TR $morningTR | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Sabah Windows gorevi kurulamadı; site yine calisiyor.' -ForegroundColor Yellow
}
& schtasks.exe /Create /F /SC DAILY /ST 19:00 /TN "JARVIS Evening Routine" /TR $eveningTR | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Aksam Windows gorevi kurulamadı; site yine calisiyor.' -ForegroundColor Yellow
}

# -------------------- SON TEST --------------------
Step '12/12 - SON KONTROLLER'

$deviceOnline = $false
try {
    $ds = Invoke-RestMethod -Method Get `
        -Uri "$ProductionUrl/api/device-status" `
        -Headers @{ 'x-jarvis-key' = $e['JARVIS_ACCESS_KEY'] } `
        -TimeoutSec 20

    $json = $ds | ConvertTo-Json -Depth 8
    if ($json -match 'online') { $deviceOnline = $true }
} catch {
    Write-Host "Device status kontrolu gecici olarak alinamadi: $($_.Exception.Message)" -ForegroundColor Yellow
}

$SecretsPath = Join-Path $Repo 'JARVIS-LOCAL-SECRETS.txt'
@"
JARVIS PRODUCTION
=================
SITE: $ProductionUrl

JARVIS ACCESS KEY:
$($e['JARVIS_ACCESS_KEY'])

PAIRING SECRET:
$($e['JARVIS_PAIRING_SECRET'])

OWNER ID:
$($e['JARVIS_OWNER_ID'])

NOT:
Bu dosya sadece bu bilgisayarda kalir ve .gitignore icindedir.
"@ | Set-Content -LiteralPath $SecretsPath -Encoding UTF8

Write-Host ""
Write-Host "SITE CANLI: $ProductionUrl" -ForegroundColor Green
Write-Host "HEALTH: OK" -ForegroundColor Green
Write-Host "GITHUB COMMIT: $CommitSha" -ForegroundColor Green
if ($deviceOnline) {
    Write-Host "WINDOWS AGENT: ONLINE" -ForegroundColor Green
} else {
    Write-Host "WINDOWS AGENT: Kuruldu; dashboard online bilgisini birkaç saniye gec gosterebilir." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "JARVIS giris anahtarin bu dosyaya kaydedildi:" -ForegroundColor Cyan
Write-Host $SecretsPath
Write-Host ""
Write-Host "Tarayici aciliyor..." -ForegroundColor Cyan
Start-Process $ProductionUrl

exit 0
