# Firebase Service Account Credentials

**⚠️ SECURITY: This directory is gitignored and should NEVER be committed to version control.**

## Files in this directory:
- `firebase-service-account.json` — Firebase Service Account key (auto-generated from Firebase Console)

## Setup Instructions:

1. Download your Firebase Service Account JSON from Firebase Console:
   - Go to: Project Settings → Service Accounts → Generate new private key
   
2. Copy the downloaded JSON file here:
   ```
   cp ~/Downloads/firebase-service-account.json ./credentials/firebase-service-account.json
   ```
   
3. Verify permissions (restrictive):
   ```
   chmod 600 ./credentials/firebase-service-account.json
   ```

4. The backend will auto-load this file via `FCM_SERVICE_ACCOUNT_PATH` env variable.

5. For production: use secrets management (AWS Secrets Manager, etc) instead of local files.

## Contents of service account JSON:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com",
  "client_id": "1234567890",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

From this file, the backend extracts:
- `private_key` → Used to authenticate with Firebase Admin SDK
- `project_id` → Firebase project identifier
- `client_email` → Service account email
