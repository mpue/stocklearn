#!/bin/bash

echo "🚀 StockLearn - Schach Lern-Applikation wird gestartet..."
echo ""

# Prüfen ob Docker läuft
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker läuft nicht. Bitte starte Docker Desktop."
    exit 1
fi

echo "✅ Docker läuft"
echo ""

# .env Dateien erstellen falls nicht vorhanden
if [ ! -f backend/.env ]; then
    echo "📝 Erstelle backend/.env..."
    cp backend/.env.example backend/.env
fi

if [ ! -f frontend/.env ]; then
    echo "📝 Erstelle frontend/.env..."
    cp frontend/.env.example frontend/.env
fi

echo "🏗️  Building und starten der Container..."
echo ""

# Docker Compose starten
docker-compose up --build

echo ""
echo "✨ Applikation wurde beendet"
