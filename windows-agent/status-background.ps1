$TaskName = 'JARVIS Windows Agent'
$AgentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Log = Join-Path $AgentDir 'logs\agent.log'
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (!$task) {
  Write-Host 'JARVIS arka plan gorevi kurulu degil.' -ForegroundColor Yellow
  exit 1
}
Write-Host "Durum: $($task.State)" -ForegroundColor Cyan
if (Test-Path $Log) {
  Write-Host ''
  Write-Host 'Son loglar:'
  Get-Content $Log -Tail 15
}
