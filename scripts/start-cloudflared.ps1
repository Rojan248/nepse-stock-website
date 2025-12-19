<#
Start-Cloudflared.ps1

PowerShell helper to guide creating and running a Cloudflare Tunnel for this project.
This script is interactive and will run `cloudflared` commands. It does not change DNS
records automatically unless you choose to run the route command.

Usage (PowerShell):
  .\scripts\start-cloudflared.ps1 -TunnelName 'nepse-tunnel' -Hostname 'nepse.me' -LocalPort 5000

Requirements:
  - `cloudflared` must be installed and on PATH
  - You must be logged in to Cloudflare account via `cloudflared tunnel login`
#>

param (
    [string]$TunnelName = 'nepse-tunnel',
    [string]$Hostname = 'nepse.me',
    [int]$LocalPort = 5000,
    [switch]$ForceCreate
)

function Run-CloudflaredCheck {
    try {
        $ver = & cloudflared --version 2>&1
        Write-Host "cloudflared found: $ver"
        return $true
    } catch {
        Write-Error "cloudflared not found. Install it first: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation"
        return $false
    }
}

if (-not (Run-CloudflaredCheck)) { exit 1 }

Write-Host "Step 1: Ensure you're logged in to Cloudflare (a browser will open)."
Write-Host "If you're already logged in, press Enter to continue or Ctrl+C to abort."
Read-Host 'Press Enter to run: cloudflared tunnel login'
& cloudflared tunnel login

Write-Host "Step 2: Check existing tunnels"
& cloudflared tunnel list

$exists = $false
try {
    $list = & cloudflared tunnel list --output json | ConvertFrom-Json
    foreach ($t in $list) {
        if ($t.name -eq $TunnelName) { $exists = $true; $tunnelId = $t.id; break }
    }
} catch {
    # non-json output, fallback to text check
    $raw = & cloudflared tunnel list 2>&1
    if ($raw -match $TunnelName) { $exists = $true }
}

if (-not $exists -or $ForceCreate) {
    Write-Host "Creating tunnel: $TunnelName"
    $createOut = & cloudflared tunnel create $TunnelName
    Write-Host $createOut
    # The create output prints the credentials file path and tunnel id; user must note them
    Write-Host "If create succeeded, note the Tunnel ID and credentials file path above."
    Write-Host "You may need to copy the credentials JSON into ./cloudflared/ and then continue."
} else {
    Write-Host "Tunnel '$TunnelName' already exists with ID $tunnelId"
}

Write-Host "Step 3: Create configuration file (cloudflared/config.yml) using example."
$examplePath = Join-Path $PSScriptRoot "..\cloudflared\config.yml.example"
$targetPath = Join-Path $PSScriptRoot "..\cloudflared\config.yml"

if (Test-Path $targetPath) {
    Write-Host "Existing config found at $targetPath"
    $overwrite = Read-Host "Overwrite it? (y/N)"
    if ($overwrite -ne 'y') { Write-Host "Skipping config write." } else { Copy-Item -Force $examplePath $targetPath; Write-Host "Written example to $targetPath. Edit it to add your tunnel ID and credentials file." }
} else {
    Copy-Item $examplePath $targetPath
    Write-Host "Written example to $targetPath. Edit it to add your tunnel ID and credentials file." 
}

Write-Host "Step 4: Route DNS (optional). This command creates a DNS record in your Cloudflare zone and maps it to the tunnel."
Write-Host "Command: cloudflared tunnel route dns $TunnelName $Hostname"
$doRoute = Read-Host "Run route DNS now? This will modify your Cloudflare DNS. Type 'yes' to continue"
if ($doRoute -eq 'yes') { & cloudflared tunnel route dns $TunnelName $Hostname }

Write-Host "Step 5: Run the tunnel (foreground). Press Ctrl+C to stop."
Write-Host "Command: cloudflared tunnel run $TunnelName"
$runNow = Read-Host "Run tunnel now? (y/N)"
if ($runNow -eq 'y') { & cloudflared tunnel run $TunnelName }

Write-Host "If you'd rather install as a Windows service run: cloudflared service install"
Write-Host "After installing service, start it from Services or with: Start-Service cloudflared"
