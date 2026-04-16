## Autonomous Testing Protocol

When asked to test the system, follow this exact sequence:

### Phase 0: Environment Cleanup

1. Kill ALL background processes EXCEPT antigravity:
```powershell
# List all Python/Node/uvicorn processes
Get-Process | Where-Object { $_.ProcessName -match 'python|node|uvicorn|npm' } | ForEach-Object {
    Write-Host "Killing: $($_.ProcessName) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
# Kill any lingering port 8000 users
$portProcess = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($portProcess) {
    Stop-Process -Id $portProcess -Force -ErrorAction SilentlyContinue
    Write-Host "Killed process on port 8000"
}
# Do NOT kill antigravity
Write-Host "Preserved: antigravity"
```

2. Clean temporary files:
```powershell
Remove-Item -Path .\data\checkpoints\* -Force -ErrorAction SilentlyContinue
# Do NOT delete audit.db — persistence must survive
```

### Phase 1: Demo Mode Testing

1. Ensure you are on the `demo` branch:
```powershell
git checkout demo
```

2. Sync dependencies:
```powershell
uv sync
```

3. Run automated test suite first:
```powershell
uv run pytest tests/ -v --tb=short
```
All tests must pass. If any fail, fix them before proceeding.

4. Start the server in background:
```powershell
Start-Process -NoNewWindow -FilePath "uv" -ArgumentList "run","uvicorn","src.main:app","--host","0.0.0.0","--port","8000"
Start-Sleep -Seconds 3
```

5. Run demo test data (10 samples):
```powershell
uv run python tests/run_demo_tests.py
```

6. Verify all 10 samples produce valid results.

7. Test dashboard is accessible:
```powershell
$dashboard = Invoke-WebRequest -Uri http://localhost:8000/dashboard -ErrorAction Stop
Write-Host "Dashboard status: $($dashboard.StatusCode)"
```

8. Kill the server after demo tests:
```powershell
Get-Process | Where-Object { $_.ProcessName -match 'python|uvicorn' } | Stop-Process -Force -ErrorAction SilentlyContinue
```

### Phase 2: Production Mode Testing

1. Switch to production branch:
```powershell
git checkout production
```

2. Set production environment:
```powershell
$env:AUTH_ENABLED = "true"
$env:RATE_LIMIT_ENABLED = "true"
$env:SIGNING_ENABLED = "false"
$env:CHECKPOINT_ENABLED = "true"
$env:PARALLEL_EXECUTION_ENABLED = "true"
```

3. Sync dependencies:
```powershell
uv sync
```

4. Start the server:
```powershell
Start-Process -NoNewWindow -FilePath "uv" -ArgumentList "run","uvicorn","src.main:app","--host","0.0.0.0","--port","8000"
Start-Sleep -Seconds 3
```

5. Login as admin to get JWT token:
```powershell
$loginBody = '{"username":"admin","password":"admin123"}'
$loginResp = Invoke-RestMethod -Method Post -Uri http://localhost:8000/auth/login -ContentType "application/json" -Body $loginBody
$TOKEN = $loginResp.access_token
$headers = @@{ Authorization = "Bearer $TOKEN" }
Write-Host "Logged in as: $($loginResp.username) (role: $($loginResp.role))"
```

6. For each production test sample from `tests/production_test_data.json`:

   **A. If document files exist** (real images available):
   - Upload each document file to the dashboard or API
   - GLM OCR will extract fields automatically
   - The `extracted_confidence` comes from OCR, not manual entry
   - Submit the application with the OCR-extracted document data

   **B. If document files do NOT exist** (no real images):
   - Use the applicant data from the JSON but construct documents manually
   - Set `extracted_confidence` to the values in the test data
   - This simulates what OCR would have extracted
   - Submit via API with auth headers:
   ```powershell
   $payload = '{ ... sample JSON ... }'
   $resp = Invoke-RestMethod -Method Post -Uri http://localhost:8000/submit_application -ContentType "application/json" -Body $payload -Headers $headers
   ```

7. Validate each response:
   - Decision must be APPROVE, REJECT, or REFER
   - Confidence must be 0.0-1.0
   - application_id must start with "app-"
   - audit_trail must list all executed agents
   - Check expected_decision matches (warn if mismatch, don't fail)

8. Test RBAC enforcement:
   ```powershell
   # Create viewer user
   Invoke-RestMethod -Method Post -Uri http://localhost:8000/auth/users -ContentType "application/json" -Headers $headers -Body '{"username":"test_viewer","password":"viewer123","role":"viewer"}'

   # Login as viewer
   $viewerLogin = Invoke-RestMethod -Method Post -Uri http://localhost:8000/auth/login -ContentType "application/json" -Body '{"username":"test_viewer","password":"viewer123"}'
   $viewerHeaders = @@{ Authorization = "Bearer $($viewerLogin.access_token)" }

   # Viewer should NOT be able to submit (expect 403)
   try {
       Invoke-RestMethod -Method Post -Uri http://localhost:8000/submit_application -ContentType "application/json" -Headers $viewerHeaders -Body $payload
       Write-Host "FAIL: Viewer was able to submit" -ForegroundColor Red
   } catch {
       Write-Host "PASS: Viewer correctly blocked from submit (403)" -ForegroundColor Green
   }

   # Viewer SHOULD be able to read audit trail
   $auditResp = Invoke-RestMethod -Uri "http://localhost:8000/audit_trail/$($resp.application_id)" -Headers $viewerHeaders
   Write-Host "PASS: Viewer can read audit trail" -ForegroundColor Green
   ```

9. Test rate limiting:
   ```powershell
   # Rapid-fire 15 submissions (limit is 10/minute)
   $blocked = $false
   for ($i = 0; $i -lt 15; $i++) {
       try {
           Invoke-RestMethod -Method Post -Uri http://localhost:8000/submit_application -ContentType "application/json" -Headers $headers -Body $payload
       } catch {
           if ($_.Exception.Response.StatusCode.value__ -eq 429) {
               Write-Host "PASS: Rate limit triggered at request $($i+1)" -ForegroundColor Green
               $blocked = $true
               break
           }
       }
   }
   if (-not $blocked) { Write-Host "INFO: Rate limit not triggered (may be disabled)" -ForegroundColor Yellow }
   ```

10. Kill server after production tests:
```powershell
Get-Process | Where-Object { $_.ProcessName -match 'python|uvicorn' } | Stop-Process -Force -ErrorAction SilentlyContinue
```

### Phase 3: GLM OCR Document Processing (Production Only)

When real document images are available at `tests/fixtures/documents/`:

1. **What the agent must do for each document image:**
   - Read the image file path from `production_test_data.json`
   - Call GLM OCR extractor: `src/ocr/glm_ocr_extractor.py`
   - The OCR extractor returns structured data:
     ```json
     {
       "full_name": "extracted name",
       "citizenship_number": "XX-XX-XX-XXXXX",
       "issue_date_bs": "20XX-XX-XX",
       "district": "extracted district",
       "extracted_confidence": 0.XX
     }
     ```
   - Use the OCR output as the document entry in the API payload
   - Do NOT use manual override fields — the whole point is testing real OCR

2. **If GLM OCR is self-hosted:**
   ```powershell
   # Verify OCR service is running
   # The OCR endpoint depends on your deployment — check src/ocr/glm_ocr_extractor.py
   ```

3. **If GLM OCR is MaaS (cloud API):**
   - Credentials must be in environment variables or config
   - Check `src/ocr/glm_ocr_extractor.py` for expected env vars

4. **If OCR is not available:**
   - Log a warning: "GLM OCR not available — using fallback structured data"
   - Fall back to manual document entries from test data JSON
   - The system should still work via heuristic scoring

### Phase 4: Final Report

After all tests complete, output this summary:

```
============================================================
  AUTONOMOUS TEST REPORT
============================================================
Demo Mode:
  - Automated tests:   XXX passed / XXX total
  - Sample submissions: XX/10 passed
  - Audit persistence:  OK / FAIL
  - Dashboard:          OK / FAIL

Production Mode:
  - Auth/RBAC:          OK / FAIL
  - Sample submissions: XX/10 passed
  - Rate limiting:      OK / FAIL / DISABLED
  - OCR pipeline:       OK / FALLBACK / NOT TESTED

Cleanup:
  - Background processes killed (except antigravity): YES
  - Server stopped: YES
============================================================
```

### Important Rules

- NEVER kill antigravity process
- ALWAYS kill Python/uvicorn/node processes between test phases
- ALWAYS use `uv run` prefix for commands
- ALWAYS check server health before running tests
- If any test phase fails, log the error and continue to next phase
- Do NOT modify source code during testing — only read and execute
- Save all test output to `tests/test_report.log`
