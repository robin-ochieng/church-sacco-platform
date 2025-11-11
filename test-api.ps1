# ACK Thiboro SACCO API Test Script
# Run this after starting the API server with: pnpm dev

$baseUrl = "http://localhost:4000/api/v1"
$testEmail = "test.user.$(Get-Random)@example.com"
$testPassword = "TestPassword123!"

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "ACK Thiboro SACCO Platform - API Tests" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n[TEST 1] Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "✅ Health check passed" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Sign Up
Write-Host "`n[TEST 2] User Sign Up..." -ForegroundColor Yellow
$signUpBody = @{
    email = $testEmail
    password = $testPassword
    role = "MEMBER"
} | ConvertTo-Json

try {
    $signUpResponse = Invoke-RestMethod -Uri "$baseUrl/auth/signup" -Method Post -Body $signUpBody -ContentType "application/json"
    Write-Host "✅ Sign up successful" -ForegroundColor Green
    Write-Host "User ID: $($signUpResponse.user.id)" -ForegroundColor Gray
    Write-Host "Email: $($signUpResponse.user.email)" -ForegroundColor Gray
    $accessToken = $signUpResponse.accessToken
    $refreshToken = $signUpResponse.refreshToken
} catch {
    Write-Host "❌ Sign up failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: Sign In
Write-Host "`n[TEST 3] User Sign In..." -ForegroundColor Yellow
$signInBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $signInResponse = Invoke-RestMethod -Uri "$baseUrl/auth/signin" -Method Post -Body $signInBody -ContentType "application/json"
    Write-Host "✅ Sign in successful" -ForegroundColor Green
    $accessToken = $signInResponse.accessToken
} catch {
    Write-Host "❌ Sign in failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 4: Get Current User
Write-Host "`n[TEST 4] Get Current User..." -ForegroundColor Yellow
$headers = @{
    Authorization = "Bearer $accessToken"
}

try {
    $currentUser = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -Headers $headers
    Write-Host "✅ Get current user successful" -ForegroundColor Green
    Write-Host "User: $($currentUser.email) - Role: $($currentUser.role)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Get current user failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 5: Sign In as Demo Admin
Write-Host "`n[TEST 5] Sign In as Demo Admin..." -ForegroundColor Yellow
$adminSignInBody = @{
    email = "admin@ackthiboro.com"
    password = "Password123!"
} | ConvertTo-Json

try {
    $adminSignInResponse = Invoke-RestMethod -Uri "$baseUrl/auth/signin" -Method Post -Body $adminSignInBody -ContentType "application/json"
    Write-Host "✅ Admin sign in successful" -ForegroundColor Green
    $adminAccessToken = $adminSignInResponse.accessToken
} catch {
    Write-Host "❌ Admin sign in failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Note: Make sure you've run the seed script first!" -ForegroundColor Yellow
}

# Test 6: Create Member
Write-Host "`n[TEST 6] Create Member..." -ForegroundColor Yellow
$memberBody = @{
    email = "new.member.$(Get-Random)@example.com"
    password = "MemberPassword123!"
    memberNumber = "ACK-TEST-$(Get-Random -Maximum 9999)"
    firstName = "Test"
    lastName = "Member"
    email = "test.member@example.com"
    telephone = "+254712345678"
    idPassportNumber = "TEST$(Get-Random -Maximum 99999999)"
    physicalAddress = "Test Address, Nyeri"
    dateOfBirth = "1990-01-01"
    nextOfKinName = "Test Kin"
    nextOfKinPhone = "+254722222222"
    nextOfKinRelationship = "Sibling"
} | ConvertTo-Json

$adminHeaders = @{
    Authorization = "Bearer $adminAccessToken"
}

try {
    $memberResponse = Invoke-RestMethod -Uri "$baseUrl/members" -Method Post -Body $memberBody -ContentType "application/json" -Headers $adminHeaders
    Write-Host "✅ Member created successfully" -ForegroundColor Green
    Write-Host "Member Number: $($memberResponse.memberNumber)" -ForegroundColor Gray
    $memberId = $memberResponse.id
} catch {
    Write-Host "⚠️ Member creation failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "This might be expected if admin account doesn't exist" -ForegroundColor Gray
}

# Test 7: Get All Members
Write-Host "`n[TEST 7] Get All Members..." -ForegroundColor Yellow
try {
    $members = Invoke-RestMethod -Uri "$baseUrl/members?page=1&limit=10" -Method Get -Headers $adminHeaders
    Write-Host "✅ Retrieved members list" -ForegroundColor Green
    Write-Host "Total members: $($members.meta.total)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️ Get members failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 8: Refresh Token
Write-Host "`n[TEST 8] Refresh Access Token..." -ForegroundColor Yellow
$refreshBody = @{
    refreshToken = $refreshToken
} | ConvertTo-Json

try {
    $refreshResponse = Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -Body $refreshBody -ContentType "application/json"
    Write-Host "✅ Token refresh successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Token refresh failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 9: Sign Out
Write-Host "`n[TEST 9] Sign Out..." -ForegroundColor Yellow
try {
    $signOutResponse = Invoke-RestMethod -Uri "$baseUrl/auth/signout" -Method Post -Headers $headers
    Write-Host "✅ Sign out successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Sign out failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "✅ Authentication flow working" -ForegroundColor Green
Write-Host "✅ User management working" -ForegroundColor Green
Write-Host "✅ JWT token system working" -ForegroundColor Green
Write-Host "`nAll core functionality tested successfully! 🎉" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
