# Stocklearn

Stocklearn ist eine Plattform zum erlernen des Schachspiels und zum verbessern des eigenen Spiels.
Hierzu kann gegen die Stockfish Engine gespielt werden. Es werden alle Spiele in der Datenbank gespeichert.
Spiele können analysiert werden. 

## 1 . Administration

- Das Admin Panel ist über die URL stocklearn-instance/admin erreichbar und wird nicht auf der User Seite verlinkt.
  Läuft der server also auf chess.cflux.org wäre die entsprechende Admin URL chess.cflux.org/admin

- Die Navigation befindet sich auf der linken Seite, dort werden alle Modlule aufgelistet, diese können per klick auf einen entprechenden Button 
  erreicht werden.

## 2. Module

Die folgenden Module sollen zur Verfügung stehen:

- Benutzerverwaltung
- Spielverwaltung
- Backup / Restore

### 2.1. Benutzerverwaltung

- Komfortable Tabellenansicht mit Filter, Paging und Sortierfunktion
- Jede Zeile hat die Actions
  
  - Löschen
  - Aktiv Flag togglen
  - Bearbeiten

Klick auf "Bearbeiten" öffnet einen Modalen Dialog um den Benutzer zu bearbeiten. Der Rest erklärt sich von selbst.

### 2.2. Spielverwaltung

- Tabellenansicht aller Spiele mit Filter (Status, Spieltyp), Paging und Sortierfunktion
- Zeigt: Spieltyp, Weiß, Schwarz, Status, Züge, Erstelldatum
- Spiele können gelöscht werden

### 2.3. Backup / Restore

- **Backup**: Erstellt eine JSON-Datei mit allen Daten (Benutzer, Spiele, Züge) zum Download
- **Restore**: Upload einer Backup-JSON-Datei mit Vorschau und Bestätigungsdialog

## 3. Technische Umsetzung

### 3.1 Datenbank

- `User` Model erweitert um `isAdmin` (Boolean, default: false) und `isActive` (Boolean, default: true)
- Migration: `20260217120219_add_admin_fields`

### 3.2 Backend API

Alle Admin-Endpunkte unter `/api/admin/` erfordern Authentifizierung + Admin-Rolle.

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | /api/admin/users | Benutzer auflisten (mit Paging, Filter, Sortierung) |
| PUT | /api/admin/users/:id | Benutzer bearbeiten |
| PATCH | /api/admin/users/:id/toggle-active | Aktiv-Status togglen |
| DELETE | /api/admin/users/:id | Benutzer löschen |
| GET | /api/admin/games | Spiele auflisten (mit Paging, Filter, Sortierung) |
| DELETE | /api/admin/games/:id | Spiel löschen |
| GET | /api/admin/stats | Statistik-Übersicht |
| POST | /api/admin/backup | Backup erstellen |
| POST | /api/admin/restore | Backup wiederherstellen |

**Setup-Endpunkte** (ohne Authentifizierung, nur wenn kein Admin existiert):

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| GET | /api/admin/setup/status | Prüft ob Setup nötig ist (`{ needsSetup: true/false }`) |
| POST | /api/admin/setup/create-admin | Erstellt den ersten Admin-Benutzer |

### 3.3 Frontend

- Route: `/admin`
- Komponenten: `AdminDashboard`, `admin/UserManagement`, `admin/GameManagement`, `admin/BackupRestore`, `admin/AdminSetup`
- CSS: `AdminDashboard.css`

### 3.4 Installer / Ersteinrichtung

Beim ersten Aufruf von `/admin` wird automatisch geprüft, ob ein Admin-Benutzer existiert.
Falls nicht, wird der **Setup-Assistent** angezeigt, über den der erste Admin-Benutzer erstellt werden kann.

**Ablauf:**
1. Benutzer navigiert zu `/admin`
2. Backend prüft via `GET /api/admin/setup/status` ob ein Admin existiert
3. Falls `needsSetup: true`: Der Installer wird angezeigt (Formular für Benutzername, E-Mail, Passwort)
4. Nach erfolgreicher Erstellung wird zur Login-Seite weitergeleitet
5. Der Setup-Endpoint ist nach Erstellung des ersten Admins automatisch deaktiviert

**Sicherheit:** Der `POST /api/admin/setup/create-admin`-Endpoint funktioniert ausschließlich, wenn noch kein Admin-Benutzer in der Datenbank existiert. Nach der Ersteinrichtung gibt er `403 Forbidden` zurück.

### 3.5 Admin-Benutzer manuell erstellen (Alternative)

Falls der Installer nicht verwendet werden soll, kann ein Admin auch manuell erstellt werden:

```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'admin@example.com';
```

Oder über die Docker-Umgebung:
```bash
docker exec -it stocklearn-db psql -U stocklearn -d stocklearn -c "UPDATE \"User\" SET \"isAdmin\" = true WHERE email = 'admin@example.com';"
```
