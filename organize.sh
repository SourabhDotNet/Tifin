#!/usr/bin/env bash
# Run from the repo root (the folder that contains server.js, routes.js, App.tsx ...)
set -e
mkdir -p backend/public frontend/src/components samples

for f in server db routes billingService pdfService excelService verify_billing; do git mv -f $f.js backend/; done
git mv -f test.html backend/public/
for f in index.html package-lock.json postcss.config.js tailwind.config.js tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts; do git mv -f $f frontend/; done
for f in App.tsx main.tsx index.css App.css; do git mv -f $f frontend/src/; done
git mv -f PUT_YOUR_COMPONENTS_HERE.txt frontend/src/components/
git mv -f test_tiffin_bill.pdf test_refreshment_bill.xlsx samples/

cat > backend/package.json <<'EOT'
{
  "name": "tiffin-refreshment-billing-backend",
  "version": "1.0.0",
  "description": "Backend API for Company Tiffin and Refreshment Billing System",
  "main": "server.js",
  "type": "module",
  "scripts": { "start": "node server.js", "dev": "nodemon server.js" },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "exceljs": "^4.4.0",
    "express": "^4.19.2",
    "pdfkit": "^0.15.0",
    "sqlite3": "^5.1.7"
  },
  "devDependencies": { "nodemon": "^3.1.0" }
}
EOT

cat > frontend/package.json <<'EOT'
{
  "name": "frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build", "preview": "vite preview" },
  "dependencies": {
    "lucide-react": "^0.435.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.4",
    "@vitejs/plugin-react": "^6.1.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "~6.0.2",
    "vite": "^8.2.2"
  }
}
EOT

printf 'node_modules\ndist\n*.log\nbackend/billing.db*\n.env\n' > .gitignore

git add -A
git commit -m "Organize project into backend/ and frontend/ folders"
git push
echo "DONE. Now add your 6 components to frontend/src/components/"
