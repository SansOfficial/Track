# Configuration
SERVER_URL="http://localhost:8080/api/workers/1"
LOG_FILE="/Users/sans/Documents/CodeRepo/Trace/scripts/monitor.log"

# SMTP Configuration (You must configure this!)
SMTP_SERVER="smtp.qq.com"
SMTP_PORT="587"
SMTP_USER="1639931768@qq.com"
SMTP_PASS="ygclyqhbdvkmeibi"
TO_EMAIL="JerryWon1214@gmail.com"

# Function to send Email via curl (works on most Linux/Mac)
send_email() {
    local message="$1"
    echo "[$(date)] ⚠️ ALERT: $message" >> "$LOG_FILE"
    
    # Sending email using curl
    # Note: --mail-from and --mail-rcpt are required
    # --ssl-reqd ensures security if supported, or remove for internal plain SMTP
    curl --url "smtp://$SMTP_SERVER:$SMTP_PORT" \
        --ssl-reqd \
        --mail-from "$SMTP_USER" \
        --mail-rcpt "$TO_EMAIL" \
        --user "$SMTP_USER:$SMTP_PASS" \
        -T <(echo -e "From: $SMTP_USER\nTo: $TO_EMAIL\nSubject: Trace System Alert\n\n$message") \
        --silent || echo "[$(date)] Failed to send email." >> "$LOG_FILE"
}

# Check Service Health
if curl -s --head --request GET "$SERVER_URL" | grep "200 OK" > /dev/null; then
    # Healthy - optional log
    # echo "[$(date)] Service is Healthy." >> "$LOG_FILE"
    exit 0
else
    # Unhealthy
    MSG="Trace System Alert: Service is DOWN or Unreachable at $(date)."
    send_email "$MSG"
    
    # Optional: Attempt auto-restart
    # cd /path/to/server && ./server &
fi
