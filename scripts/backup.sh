#!/bin/bash

# Configuration
# Default backup path (can be changed to U-disk mount point, e.g., /Volumes/MyUSB/TraceBackups)
BACKUP_DIR="/Users/sans/Documents/CodeRepo/Trace/backups"
DB_USER="root"
DB_PASS="Wang0616"
DB_NAME="trace"
RETENTION_DAYS=7

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# 1. Perform Backup
echo "[$(date)] Starting backup to $FILENAME..."
if mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$FILENAME"; then
    echo "[$(date)] Backup SUCCESS: $FILENAME"
    
    # 2. Cleanup old backups (Retention Policy)
    find "$BACKUP_DIR" -name "db_backup_*.sql" -mtime +$RETENTION_DAYS -exec rm {} \;
    echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days."
else
    echo "[$(date)] Backup FAILED!"
    # Trigger alert here if needed
    exit 1
fi
