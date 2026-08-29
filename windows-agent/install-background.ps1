$ErrorActionPreference = 'Stop'
$TaskName = 'JARVIS Windows Agent'
$AgentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonW = Join-Path $AgentDir '.venv\Scripts\pythonw.exe'
$AgentPy = Join-Path $AgentDir 'agent.py'
$EnvFile = Join-Path $AgentDir '.env'

if (!(Test-Path $PythonW)) {
    Write-Host 'HATA: Once install.bat calistir.' -ForegroundColor Red
    exit 1
}
if (!(Test-Path $EnvFile)) {
    Write-Host 'HATA: windows-agent\.env bulunamadi.' -ForegroundColor Red
    exit 1
}

$envText = Get-Content $EnvFile -Raw
if ($envText -match '(?m)^JARVIS_DEVICE_TOKEN=\s*$') {
    Write-Host 'HATA: Once run.bat ile bir kez eslestirme yap. JARVIS_DEVICE_TOKEN bos.' -ForegroundColor Red
    exit 1
}

$action = New-ScheduledTaskAction -Execute $PythonW -Argument ('"' + $AgentPy + '"') -WorkingDirectory $AgentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'JARVIS Windows Agent - arka planda otomatik baslar.' | Out-Null
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2

$state = (Get-ScheduledTask -TaskName $TaskName).State
Write-Host ''
Write-Host 'JARVIS arka plan servisi kuruldu.' -ForegroundColor Green
Write-Host "Durum: $state"
Write-Host 'Windows acildiginda otomatik baslayacak. CMD acik kalmayacak.'
Write-Host "Log: $AgentDir\logs\agent.log"
