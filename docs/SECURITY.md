# Security Best Practices

## 1. Environment Variables

- **Never commit .env files**: Ensure `.env`, `.env.local`, and `.env.production` are in `.gitignore`.
- **Secrets Management**: Use strong, unique passwords for any database or service accounts.
- **Production Values**: Create the `.env` file directly on the production server.
- **Database URL**: Keep `DATABASE_URL` secure and use relative paths for SQLite.

## 2. Server Security

### Firewall
- **Local Network**: If only accessing locally, you may not need strict firewall rules.
- **Public Access**: 
  - **Linux (UFW)**: Allow only essential ports (SSH, 80/443).
    ```bash
    sudo ufw allow ssh
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw enable
    ```
  - **Windows**: Configure Windows Defender Firewall to allow Node.js only on Private networks if possible.

### Updates
- Keep Node.js updated to the latest LTS version.
- Regularly update system packages (`apt update` / Windows Update).
- Run `npm audit` periodically to check for vulnerable dependencies.

### User Permissions
- Avoid running the application as `root` or Administrator if possible.
- Create a dedicated standard user for running the Node.js process.
- Ensure the application user has write access only to necessary directories (`logs`, `prisma`, `data`).

## 3. Application Security

### Protection Modules
The application uses security middleware:
- **Rate Limiting**: Configured to prevent abuse of API endpoints.
- **CORS**: Cross-Origin Resource Sharing policies restrict API access.
- **Helmet**: Secure HTTP headers (should be added to `server.js`).
- **Input Validation**: All API inputs are validated before processing.

### Database Security
- **SQLite**: Database file stored locally, not exposed to network.
- **Prisma ORM**: Parameterized queries prevent SQL injection.
- **Backups**: Regular backups of `backend/prisma/dev.db` recommended.

### No Authentication
The application is a public data dashboard and does not require authentication:
- No user accounts or sessions
- No sensitive personal data stored
- All displayed data is publicly available NEPSE information

## 4. Data Integrity

### Watchdog Service
The built-in Watchdog service protects data integrity:
- **Verification**: Compares local data with external sources
- **Auto-Correction**: Fixes discrepancies automatically
- **Logging**: Maintains audit trail in `backend/logs/watchdog_verification.json`

### Data Sources
- **Primary**: NEPSE official API
- **Verification**: Merolagani, NepseAlpha (external providers)

## 5. Monitoring & Backup

### Logs
- Check PM2 logs regularly: `npm run pm2:logs`
- Monitor for repeated error patterns or unauthorized access attempts.
- Review Watchdog verification logs for data discrepancies.

### Backups
- **Database**: Periodically back up `backend/prisma/dev.db`.
- **JSON Data**: Back up `backend/data/` directory (fallback storage).
- **Config**: Keep a secure copy of your production `.env` file credentials.
- **Full Backup**: Schedule regular backups of the entire application folder.

### Recommended Backup Schedule
| Data | Frequency | Method |
|------|-----------|--------|
| SQLite Database | Daily | Copy `dev.db` to backup location |
| JSON Data | Weekly | Archive `backend/data/` folder |
| Full Application | Monthly | Full directory backup |

## 6. Network Security (If Exposing to Internet)

### Port Forwarding
- Only forward necessary ports (80, 443)
- Use a reverse proxy (Nginx) instead of exposing Node.js directly
- Enable HTTPS with valid SSL certificates

### Reverse Proxy (Recommended)
```nginx
server {
    listen 443 ssl;
    server_name nepse.me;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
}
```

### DDoS Protection
Consider using:
- **Cloudflare** (free tier) for DDoS protection and CDN
- **Rate limiting** at the reverse proxy level
- **Fail2ban** for blocking abusive IPs
