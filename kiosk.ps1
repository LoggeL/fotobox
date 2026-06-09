# Startet den Server und oeffnet Chrome im Kiosk-Modus auf dem Touchscreen
$server = Start-Process node -ArgumentList "node_modules/tsx/dist/cli.mjs", "src/server.ts" -WorkingDirectory $PSScriptRoot -PassThru
Start-Sleep -Seconds 2
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" }
& $chrome --kiosk --app=http://localhost:3000 --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required
Stop-Process -Id $server.Id -Force
