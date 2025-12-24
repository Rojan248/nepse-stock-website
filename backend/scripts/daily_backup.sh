#!/bin/bash
# Navigate to backend directory relative to script
cd "$(dirname "$0")/.."

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="../backups"
DATA_DIR="./data"

mkdir -p "$BACKUP_DIR"

echo "[Backup] Zipping $DATA_DIR to $BACKUP_DIR/backup_$TIMESTAMP.zip..."
zip -r "$BACKUP_DIR/backup_$TIMESTAMP.zip" "$DATA_DIR" -x "*.tmp"

# Delete backups older than 7 days
find "$BACKUP_DIR" -type f -name "*.zip" -mtime +7 -delete
echo "[Backup] Cleanup complete."
