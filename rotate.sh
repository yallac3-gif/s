#!/bin/bash

# ==============================================================================
# INFRASTRUCTURE ROTATION SCRIPT (rotate.sh)
# Purpose: Automates the rotation of frontend deployments and updates backend CORS.
# Designed for: DevOps Portfolio Project
# ==============================================================================

# --- Configuration & Environment Check ---
LAST_DEPLOY_FILE=".last_deploy"
LOG_FILE="rotation.log"
ROTATION_INTERVAL_SECONDS=$((3 * 3600)) # 3 hours in seconds

# Ensure required environment variables are present
REQUIRED_VARS=("TELEGRAM_TOKEN" "TELEGRAM_CHAT_ID" "NETLIFY_AUTH_TOKEN" "NETLIFY_SITE_ID" "RENDER_API_KEY" "RENDER_SERVICE_ID")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Environment variable $var is not set."
        exit 1
    fi
done

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

send_telegram() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$message" \
        -d "parse_mode=HTML" > /dev/null
}

# --- 1. Check Rotation Eligibility ---
if [ -f "$LAST_DEPLOY_FILE" ]; then
    LAST_DEPLOY_TS=$(cat "$LAST_DEPLOY_FILE")
    CURRENT_TS=$(date +%s)
    ELAPSED=$((CURRENT_TS - LAST_DEPLOY_TS))

    if [ "$ELAPSED" -lt "$ROTATION_INTERVAL_SECONDS" ]; then
        log_message "Rotation skipped: Only $((ELAPSED / 60)) minutes elapsed since last deploy."
        exit 0
    fi
fi

log_message "Starting infrastructure rotation..."

# --- 2. Build Frontend ---
log_message "Building frontend assets..."
npm install > /dev/null 2>&1
if ! npm run build; then
    log_message "Error: Build failed."
    send_telegram "❌ <b>Rotation Failed:</b> Build step failed."
    exit 1
fi

# --- 3. Deploy to Netlify ---
log_message "Deploying to Netlify..."
# We use the Netlify CLI to deploy and capture the production URL
DEPLOY_OUTPUT=$(npx netlify-cli deploy --prod --dir=dist --auth="$NETLIFY_AUTH_TOKEN" --site="$NETLIFY_SITE_ID")
NEW_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE "https://[a-zA-Z0-9.-]+\.netlify\.app" | head -n 1)

if [ -z "$NEW_URL" ]; then
    log_message "Error: Failed to capture Netlify URL."
    send_telegram "❌ <b>Rotation Failed:</b> Netlify deployment failed or URL not found."
    exit 1
fi

log_message "New Deployment URL: $NEW_URL"

# --- 4. Update Backend CORS (Render API) ---
log_message "Updating Render backend CORS (ALLOWED_ORIGIN)..."
# Render API requires fetching current env vars, updating one, and sending them all back
# For simplicity in this portfolio script, we use a direct PATCH if supported or a standard update flow
# Note: This uses the Render API to update the ALLOWED_ORIGIN environment variable

RENDER_API_URL="https://api.render.com/v1/services/$RENDER_SERVICE_ID/env-vars"

# Fetch current env vars to find the one to update
CURRENT_VARS=$(curl -s -X GET "$RENDER_API_URL" -H "Authorization: Bearer $RENDER_API_KEY")

# Create the JSON payload for the update
# We are updating the 'ALLOWED_ORIGIN' key with the 'NEW_URL'
UPDATE_JSON="[{\"key\": \"ALLOWED_ORIGIN\", \"value\": \"$NEW_URL\"}]"

UPDATE_RESPONSE=$(curl -s -X PUT "$RENDER_API_URL" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$UPDATE_JSON")

if [[ "$UPDATE_RESPONSE" == *"ALLOWED_ORIGIN"* ]]; then
    log_message "Backend CORS updated successfully."
else
    log_message "Error: Failed to update Render environment variables."
    log_message "Response: $UPDATE_RESPONSE"
    send_telegram "❌ <b>Rotation Failed:</b> Backend CORS update failed."
    exit 1
fi

# --- 5. Finalize ---
echo "$(date +%s)" > "$LAST_DEPLOY_FILE"
log_message "Rotation complete. New URL: $NEW_URL"

send_telegram "🔄 <b>Infra Rotation Success</b>
<b>New URL:</b> <code>$NEW_URL</code>
<b>Backend:</b> Render (CORS Updated)
<b>Status:</b> Production Live"

exit 0
