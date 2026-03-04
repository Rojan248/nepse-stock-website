Get-Process | Where-Object { $_.Name -like "*lm*" -or $_.Name -like "*studio*" } | Select-Object Name, Id | Format-Table
Write-Host "--- Port 1234 ---"
$conn = Get-NetTCPConnection -LocalPort 1234 -ErrorAction SilentlyContinue
if ($conn) { Get-Process -Id $conn.OwningProcess | Select-Object Name, Id | Format-Table }
