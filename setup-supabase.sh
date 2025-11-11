#!/bin/bash

# Church SACCO Platform - Supabase Setup Script
# This script helps you set up your Supabase database

echo "🚀 Church SACCO Platform - Supabase Setup"
echo "=========================================="
echo ""

# Check if .env files exist
if [ ! -f "db/.env" ]; then
  echo "⚠️  db/.env not found. Creating from example..."
  cp db/.env.example db/.env
fi

if [ ! -f "apps/api/.env" ]; then
  echo "⚠️  apps/api/.env not found. Creating from example..."
  cp apps/api/.env.example apps/api/.env
fi

echo ""
echo "📝 Please complete the following steps:"
echo ""
echo "1. Create a Supabase account at: https://supabase.com"
echo "2. Create a new project and note your database password"
echo "3. Get your connection string from:"
echo "   Dashboard > Settings > Database > Connection string > URI"
echo ""
echo "4. Update the DATABASE_URL in these files:"
echo "   - db/.env"
echo "   - apps/api/.env"
echo ""
echo "   Replace the placeholder with your actual Supabase connection string:"
echo "   DATABASE_URL=\"postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres\""
echo ""
read -p "Have you updated the DATABASE_URL? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "✅ Great! Now running database setup..."
  echo ""
  
  echo "📦 Generating Prisma Client..."
  pnpm db:generate
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "🔄 Running migrations..."
    pnpm db:migrate
    
    if [ $? -eq 0 ]; then
      echo ""
      echo "🌱 Seeding database..."
      pnpm db:seed
      
      if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Database setup complete!"
        echo ""
        echo "🎉 You can now start your development server:"
        echo "   pnpm dev"
        echo ""
        echo "📊 Or open Prisma Studio to view your data:"
        echo "   pnpm db:studio"
      else
        echo ""
        echo "❌ Seeding failed. Please check your database connection."
      fi
    else
      echo ""
      echo "❌ Migration failed. Please check your database connection."
    fi
  else
    echo ""
    echo "❌ Prisma Client generation failed."
  fi
else
  echo ""
  echo "⏸️  Setup paused. Please update your .env files and run this script again."
  echo ""
  echo "💡 Tip: See SUPABASE_SETUP.md for detailed instructions"
fi
