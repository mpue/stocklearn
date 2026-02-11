#!/bin/bash
# Test-Script für chess.cflux.org Deployment

echo "=== Testing Docker Containers ==="
echo "Checking if containers are running..."
docker-compose ps
echo ""

echo "=== Testing Backend (localhost:3004) ==="
echo "Testing health endpoint..."
curl -s http://localhost:3004/health | jq . || echo "Health check failed"
echo ""

echo "Testing API endpoint..."
curl -s http://localhost:3004/api/games | jq . || echo "API call failed (expected if not authenticated)"
echo ""

echo "=== Testing WebSocket Connection ==="
echo "Connecting to Socket.IO on localhost:3004..."
timeout 2 curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:3004/socket.io/ 2>&1 | head -20
echo ""

echo "=== Testing Frontend (localhost:3005) ==="
echo "Testing frontend..."
curl -s -I http://localhost:3005 | head -5
echo ""

echo "=== Testing through Caddy (https://chess.cflux.org) ==="
echo "Testing health endpoint through Caddy..."
curl -s https://chess.cflux.org/health | jq . || echo "Caddy health check failed"
echo ""

echo "Testing WebSocket through Caddy..."
timeout 2 curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://chess.cflux.org/socket.io/ 2>&1 | head -20
echo ""

echo "=== Checking Caddy Status ==="
sudo systemctl status caddy --no-pager | head -15
echo ""

echo "=== Recent Caddy Logs ==="
sudo journalctl -u caddy --no-pager -n 20
echo ""

echo "=== Recent Backend Logs ==="
docker-compose logs backend --tail 20
