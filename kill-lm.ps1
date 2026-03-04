param(
    [switch]$Force
)

$conn = Get-NetTCPConnection -LocalPort 1234 -ErrorAction SilentlyContinue
if ($conn) {
    $procId = $conn.OwningProcess | Select-Object -First 1
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Found: $($proc.Name) (PID $procId)"
        # Non-interactive force-kill requires the explicit -Force flag;
        # without it, PowerShell will prompt before terminating the process.
        if ($Force) {
            Stop-Process -Id $procId -Force
        } else {
            Stop-Process -Id $procId -Confirm
        }
        Write-Host "Killed."
    } else {
        Write-Host "Process not found (PID $procId)"
    }
} else {
    Write-Host "Nothing on port 1234"
}
