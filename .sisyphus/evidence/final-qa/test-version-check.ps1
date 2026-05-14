# Test script to verify Node.js version check
# This simulates the version check logic from install.ps1

$ErrorActionPreference = "Stop"

# Mock node command to return version 16
function Test-VersionCheck {
    param([int]$MockVersion)
    
    Write-Host "Testing with Node.js version $MockVersion..."
    
    if ($MockVersion -lt 18) {
        Write-Host "ERROR: node v$MockVersion.0.0 too old (need >= 18)"
        return $false
    } else {
        Write-Host "OK: node v$MockVersion.0.0 meets requirement"
        return $true
    }
}

# Test with version 16 (should fail)
Write-Host "`n=== Test 1: Node.js v16 (should fail) ==="
$result1 = Test-VersionCheck -MockVersion 16

# Test with version 18 (should pass)
Write-Host "`n=== Test 2: Node.js v18 (should pass) ==="
$result2 = Test-VersionCheck -MockVersion 18

# Test with version 24 (should pass)
Write-Host "`n=== Test 3: Node.js v24 (should pass) ==="
$result3 = Test-VersionCheck -MockVersion 24

Write-Host "`n=== Summary ==="
Write-Host "Test 1 (v16): $(if (-not $result1) { 'PASS (correctly rejected)' } else { 'FAIL' })"
Write-Host "Test 2 (v18): $(if ($result2) { 'PASS (correctly accepted)' } else { 'FAIL' })"
Write-Host "Test 3 (v24): $(if ($result3) { 'PASS (correctly accepted)' } else { 'FAIL' })"
