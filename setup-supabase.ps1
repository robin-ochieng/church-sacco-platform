# Church SACCO Platform - Supabase Setup Script (PowerShell)
# This script helps you set up your Supabase database

Write-Host ""
Write-Host "🚀 Church SACCO Platform - Supabase Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env files exist
if (-Not (Test-Path "db\.env")) {
    Write-Host "⚠️  db\.env not found. Creating from example..." -ForegroundColor Yellow
    Copy-Item "db\.env.example" "db\.env"
}

if (-Not (Test-Path "apps\api\.env")) {
    Write-Host "⚠️  apps\api\.env not found. Creating from example..." -ForegroundColor Yellow
    Copy-Item "apps\api\.env.example" "apps\api\.env"
}

Write-Host ""
Write-Host "📝 Please complete the following steps:" -ForegroundColor White
Write-Host ""
Write-Host "1. Create a Supabase account at: https://supabase.com"
Write-Host "2. Create a new project and note your database password"
Write-Host ""
Write-Host "3. Get your Supabase credentials from Dashboard > Settings > API:" -ForegroundColor Cyan
Write-Host "   - Project URL (SUPABASE_URL)"
Write-Host "   - Anon key (SUPABASE_ANON_KEY)"
Write-Host "   - Service role key (SUPABASE_SERVICE_ROLE_KEY)"
Write-Host ""
Write-Host "4. Get your database connection string from Dashboard > Settings > Database:" -ForegroundColor Cyan
Write-Host "   - Connection string > URI (DATABASE_URL)"
Write-Host ""
Write-Host "5. Update the following files with your credentials:" -ForegroundColor Yellow
Write-Host "   - db\.env"
Write-Host "   - apps\api\.env"
Write-Host "   - apps\web\.env"
Write-Host ""
Write-Host "   Required variables:" -ForegroundColor Green
Write-Host "   SUPABASE_URL=https://xxxxx.supabase.co"
Write-Host "   SUPABASE_ANON_KEY=eyJhbG..."
Write-Host "   SUPABASE_SERVICE_ROLE_KEY=eyJhbG..."
Write-Host "   DATABASE_URL=postgresql://postgres:..."
Write-Host ""

$response = Read-Host "Have you updated all the environment variables? (y/n)"

if ($response -eq "y" -or $response -eq "Y") {
    Write-Host ""
    Write-Host "✅ Great! Now installing Supabase SDK and setting up database..." -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    pnpm install
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "📦 Generating Prisma Client..." -ForegroundColor Cyan
        pnpm db:generate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🔄 Running migrations..." -ForegroundColor Cyan
        pnpm db:migrate
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "🌱 Seeding database..." -ForegroundColor Cyan
            pnpm db:seed
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Database setup complete!" -ForegroundColor Green
                Write-Host ""
                Write-Host "🎉 You can now start your development server:" -ForegroundColor Cyan
                Write-Host "   pnpm dev" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "📊 Or open Prisma Studio to view your data:" -ForegroundColor Cyan
                Write-Host "   pnpm db:studio" -ForegroundColor Yellow
            } else {
                Write-Host ""
                Write-Host "❌ Seeding failed. Please check your database connection." -ForegroundColor Red
            }
        } else {
            Write-Host ""
            Write-Host "❌ Migration failed. Please check your database connection." -ForegroundColor Red
        }
    } else {
        Write-Host ""
        Write-Host "❌ Prisma Client generation failed." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "⏸️  Setup paused. Please update your .env files and run this script again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Tip: See SUPABASE_SETUP.md for detailed instructions" -ForegroundColor Cyan
}

Write-Host ""
