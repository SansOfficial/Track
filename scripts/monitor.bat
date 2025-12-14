@echo off
setlocal

set "SERVER_URL=http://localhost:8080/api/workers/1"
set "LOG_FILE=C:\TraceBackups\monitor.log"

:: SMTP Configuration (Configure this!)
set "SMTP_SERVER=smtp.qq.com"
set "SMTP_USER=1639931768@qq.com"
set "SMTP_PASS=hhxnvwhaaejsejje"
set "TO_EMAIL=JerryWon1214@gmail.com"

:: Check Service via curl
curl -s --head --request GET "%SERVER_URL%" | find "200 OK" > nul

if %ERRORLEVEL% EQU 0 (
    :: Healthy - do nothing
) else (
    echo [%DATE% %TIME%] ALERT: Service is DOWN. Sending Email... >> "%LOG_FILE%"
    
    :: Send Email using PowerShell
    powershell -Command "Send-MailMessage -From '%SMTP_USER%' -To '%TO_EMAIL%' -Subject 'Trace Alert: Service DOWN' -Body 'The Trace Server is unreachable at %DATE% %TIME%.' -SmtpServer '%SMTP_SERVER%' -Credential (New-Object System.Management.Automation.PSCredential('%SMTP_USER%', (ConvertTo-SecureString '%SMTP_PASS%' -AsPlainText -Force))) -UseSsl" >> "%LOG_FILE%" 2>&1
)

endlocal
