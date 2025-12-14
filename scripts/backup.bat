@echo off
setlocal

:: Configuration
:: Modify this to your U-disk path (e.g. E:\TraceBackups)
set "BACKUP_DIR=C:\TraceBackups"
set "DB_USER=root"
set "DB_PASS=Wang0616"
set "DB_NAME=trace"
set "RETENTION_DAYS=7"

:: Create directory if not exists
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Generate Timestamp (YearMonthDay_HourMinute)
set "TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%"
:: Fix single digit hour with zero
set "TIMESTAMP=%TIMESTAMP: =0%"

set "FILENAME=%BACKUP_DIR%\db_backup_%TIMESTAMP%.sql"

echo [%DATE% %TIME%] Starting backup to %FILENAME%...

:: Perform Backup (Ensure mysqldump is in PATH)
mysqldump -u%DB_USER% -p%DB_PASS% %DB_NAME% > "%FILENAME%"

if %ERRORLEVEL% EQU 0 (
    echo [%DATE% %TIME%] Backup SUCCESS.
    
    :: Cleanup old files (older than RETENTION_DAYS)
    :: /p defaults to current dir, needs to point to BACKUP_DIR
    forfiles /p "%BACKUP_DIR%" /m db_backup_*.sql /d -%RETENTION_DAYS% /c "cmd /c del @path"
    echo [%DATE% %TIME%] Cleanup completed.
) else (
    echo [%DATE% %TIME%] Backup FAILED.
)

endlocal
