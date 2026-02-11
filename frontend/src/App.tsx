import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { Dashboard } from './components/Dashboard'
import { ChessGame } from './components/ChessGame'
import { GameAnalysis } from './components/GameAnalysis'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
