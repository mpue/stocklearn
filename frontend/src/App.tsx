import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { SocketProvider } from './contexts/SocketContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { Dashboard } from './components/Dashboard'
import { ChessGame } from './components/ChessGame'
import { GameAnalysis } from './components/GameAnalysis'
import { AdminDashboard } from './components/AdminDashboard'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter 
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/game/:gameId" 
              element={
                <ProtectedRoute>
                  <ChessGame />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/analysis/:gameId" 
              element={
                <ProtectedRoute>
                  <GameAnalysis />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={<AdminDashboard />}
            />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App
