# Security Best Practices

## 1. Environment Variables

- **Never commit .env files**: Ensure `.env`, `.env.local`, and `.env.production` are in `.gitignore`.
- **Secrets Management**: Use strong, unique passwords for any database or service accounts.
- **Production Values**: Create the `.env` file directly on the production server.

## 2. Server Security

### Firewall
- **Local Network**: If only accessing locally, you may not need strict firewall rules.
- **Public Access**: 
  - **Linux (UFW)**: Allow only essential ports (SSH, 80/443 if not using Tunnel).
    ```bash
    sudo ufw allow ssh
    sudo ufw enable
    ```
  - **Windows**: Configure Windows Defender Firewall to allow Node.js only on Private networks if possible.
  - **Cloudflare Tunnel**: If using Cloudflare Tunnel, you do not need to open ANY inbound ports (no port forwarding required).

### Updates
- Keep Node.js updated to the latest LTS version.
- Regularly update system packages (`apt update` / Windows Update).
- Run `npm audit` periodically to check for vulnerable dependencies.

### User Permissions
- Avoid running the application as `root` or Administrator if possible.
- Create a dedicated standard user for running the Node.js process.

## 3. Application Security

### Protection Modules
The application should use security middleware:
- **Rate Limiting**: configured to prevent abuse of API endpoints.
- **CORS**: Strict Cross-Origin Resource Sharing policies to allow only your domain.
- **Helmet**: secure HTTP headers (should be added to `server.js`).

### Input Validation
- All API inputs are validated.
- Since we use local JSON storage, SQL injection is not a primary concern, but input sanitation is still practiced.

## 4. Monitoring & Backup

### Logs
- Check PM2 logs regularly: `npm run pm2:logs`
- Monitor for repeated error patterns or unauthorized access attempts.

### Backups
- **Data**: Periodically back up the `backend/data/` directory.
- **Config**: Keep a secure copy of your production `.env` file credentials.
- **Full Backup**: Schedule regular backups of the entire application folder.

## 5. Cloudflare Security (If using Tunnel)
- **Encryption**: Traffic is encrypted from the user all the way to your server.
- **DDoS Protection**: Cloudflare absorbs attack traffic.
- **Access Rules**: You can configure Cloudflare Access to restrict who can visit your site (e.g., via email login).
