$TaskName = 'JARVIS Windows Agent'
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'JARVIS arka plan gorevi kaldirildi.' -ForegroundColor Green
