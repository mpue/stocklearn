import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { ChessGame } from './components/ChessGame'
import { GameAnalysis } from './components/GameAnalysis'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/game/:gameId" element={<ChessGame />} />
        <Route path="/analysis/:gameId" element={<GameAnalysis />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
