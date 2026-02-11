import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { api } from '../api/client';
import './GameAnalysis.css';

interface MoveAnalysis {
  moveNumber: number;
  move: string;
  from: string;
  to: string;
  isPlayerMove: boolean;
  evaluation: number;
  mate?: number;
  bestMove: string;
  bestMoveEval: number;
  classification: string;
  evalDiff: number;
  fen: string;
}

interface AnalysisResponse {
  gameId: string;
  analysis: MoveAnalysis[];
  summary: {
    totalMoves: number;
    blunders: number;
    mistakes: number;
    inaccuracies: number;
    brilliancies: number;
  };
}

export function GameAnalysis() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [game, setGame] = useState<Chess>(new Chess());

  useEffect(() => {
    if (gameId) {
      analyzeGame(gameId);
    }
  }, [gameId]);

  const analyzeGame = async (id: string) => {
    try {
      setLoading(true);
      const result = await api.analyzeGame(id);
      setAnalysis(result);
      setCurrentMoveIndex(-1);
      setGame(new Chess());
    } catch (error) {
      console.error('Error analyzing game:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToMove = (index: number) => {
    if (!analysis) return;
    
    const chess = new Chess();
    if (index >= 0) {
      for (let i = 0; i <= index; i++) {
        const move = analysis.analysis[i];
        chess.move({ from: move.from, to: move.to });
      }
    }
    setGame(chess);
    setCurrentMoveIndex(index);
  };

  const nextMove = () => {
    if (!analysis || currentMoveIndex >= analysis.analysis.length - 1) return;
    goToMove(currentMoveIndex + 1);
  };

  const previousMove = () => {
    if (currentMoveIndex <= -1) return;
    goToMove(currentMoveIndex - 1);
  };

  const getEvalDisplay = (evaluation: number, mate?: number) => {
    if (mate !== undefined) {
      return `M${mate}`;
    }
    const sign = evaluation >= 0 ? '+' : '';
    return `${sign}${evaluation.toFixed(2)}`;
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'brilliant': return '#1e90ff';
      case 'good': return '#96bf6b';
      case 'inaccuracy': return '#f0ad4e';
      case 'mistake': return '#ff8c00';
      case 'blunder': return '#dc3545';
      default: return '#999';
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'brilliant': return '!!';
      case 'good': return '';
      case 'inaccuracy': return '?!';
      case 'mistake': return '?';
      case 'blunder': return '??';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="game-analysis loading-screen">
        <div className="loading-spinner">
          <h2>🔍 Analysiere Spiel...</h2>
          <p>Stockfish evaluiert alle Positionen</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="game-analysis">
        <div className="error-screen">
          <h2>Fehler beim Laden der Analyse</h2>
          <button onClick={() => navigate('/')}>Zurück zum Dashboard</button>
        </div>
      </div>
    );
  }

  const currentAnalysis = currentMoveIndex >= 0 ? analysis.analysis[currentMoveIndex] : null;

  return (
    <div className="game-analysis">
      <div className="analysis-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Zurück zum Dashboard
        </button>
        <h1>📊 Spielanalyse</h1>
      </div>

      <div className="analysis-container">
        <div className="board-section">
          <div className="board-wrapper">
            <Chessboard
              position={game.fen()}
              boardWidth={560}
              arePiecesDraggable={false}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
              }}
            />
          </div>

          <div className="move-controls">
            <button onClick={() => goToMove(-1)} disabled={currentMoveIndex === -1}>
              ⏮ Start
            </button>
            <button onClick={previousMove} disabled={currentMoveIndex === -1}>
              ◀ Zurück
            </button>
            <button onClick={nextMove} disabled={currentMoveIndex >= analysis.analysis.length - 1}>
              Vor ▶
            </button>
            <button onClick={() => goToMove(analysis.analysis.length - 1)} disabled={currentMoveIndex === analysis.analysis.length - 1}>
              Ende ⏭
            </button>
          </div>

          {currentAnalysis && (
            <div className="current-move-info">
              <div className="move-header">
                <h3>Zug {Math.floor(currentAnalysis.moveNumber / 2) + 1}: {currentAnalysis.move}</h3>
                <span
                  className="classification-badge"
                  style={{ backgroundColor: getClassificationColor(currentAnalysis.classification) }}
                >
                  {currentAnalysis.classification.toUpperCase()} {getClassificationLabel(currentAnalysis.classification)}
                </span>
              </div>
              <div className="eval-info">
                <div className="eval-item">
                  <strong>Bewertung:</strong>
                  <span className={currentAnalysis.evaluation >= 0 ? 'eval-positive' : 'eval-negative'}>
                    {getEvalDisplay(currentAnalysis.evaluation, currentAnalysis.mate)}
                  </span>
                </div>
                {currentAnalysis.evalDiff !== 0 && (
                  <div className="eval-item">
                    <strong>Änderung:</strong>
                    <span className={currentAnalysis.evalDiff >= 0 ? 'eval-positive' : 'eval-negative'}>
                      {currentAnalysis.evalDiff > 0 ? '+' : ''}{currentAnalysis.evalDiff.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="eval-item">
                  <strong>Bester Zug:</strong>
                  <span>{currentAnalysis.bestMove} ({getEvalDisplay(currentAnalysis.bestMoveEval)})</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="analysis-sidebar">
          <div className="summary-card">
            <h2>Zusammenfassung</h2>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Gespielte Züge:</span>
                <span className="summary-value">{analysis.summary.totalMoves}</span>
              </div>
              <div className="summary-item blunders">
                <span className="summary-label">Grobe Fehler:</span>
                <span className="summary-value">{analysis.summary.blunders}</span>
              </div>
              <div className="summary-item mistakes">
                <span className="summary-label">Fehler:</span>
                <span className="summary-value">{analysis.summary.mistakes}</span>
              </div>
              <div className="summary-item inaccuracies">
                <span className="summary-label">Ungenauigkeiten:</span>
                <span className="summary-value">{analysis.summary.inaccuracies}</span>
              </div>
              <div className="summary-item brilliancies">
                <span className="summary-label">Brillante Züge:</span>
                <span className="summary-value">{analysis.summary.brilliancies}</span>
              </div>
            </div>
          </div>

          <div className="eval-chart">
            <h3>Evaluations-Verlauf</h3>
            <div className="chart-container">
              <svg viewBox="0 0 400 150" className="eval-svg">
                <line x1="0" y1="75" x2="400" y2="75" stroke="#ccc" strokeWidth="1" />
                {analysis.analysis.map((move, index) => {
                  const x = (index / (analysis.analysis.length - 1)) * 400;
                  const clampedEvaluation = Math.max(-10, Math.min(10, move.evaluation));
                  const y = 75 - (clampedEvaluation / 10) * 60;
                  const nextMove = analysis.analysis[index + 1];
                  
                  if (nextMove) {
                    const nextX = ((index + 1) / (analysis.analysis.length - 1)) * 400;
                    const nextClampedEvaluation = Math.max(-10, Math.min(10, nextMove.evaluation));
                    const nextY = 75 - (nextClampedEvaluation / 10) * 60;
                    
                    return (
                      <line
                        key={index}
                        x1={x}
                        y1={y}
                        x2={nextX}
                        y2={nextY}
                        stroke={move.isPlayerMove ? '#667eea' : '#999'}
                        strokeWidth="2"
                      />
                    );
                  }
                  return null;
                })}
                {analysis.analysis.map((move, index) => {
                  const x = (index / (analysis.analysis.length - 1)) * 400;
                  const clampedEvaluation = Math.max(-10, Math.min(10, move.evaluation));
                  const y = 75 - (clampedEvaluation / 10) * 60;
                  
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={index === currentMoveIndex ? 6 : 3}
                      fill={getClassificationColor(move.classification)}
                      onClick={() => goToMove(index)}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </svg>
              <div className="chart-labels">
                <span>+10</span>
                <span>0</span>
                <span>-10</span>
              </div>
            </div>
          </div>

          <div className="moves-list-analysis">
            <h3>Züge</h3>
            <div className="moves-scroll">
              {analysis.analysis.map((move, index) => (
                <div
                  key={index}
                  className={`move-analysis-item ${index === currentMoveIndex ? 'active' : ''}`}
                  onClick={() => goToMove(index)}
                >
                  <div className="move-number-analysis">
                    {Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'}
                  </div>
                  <div className="move-san">{move.move}</div>
                  <div
                    className="move-classification"
                    style={{ color: getClassificationColor(move.classification) }}
                  >
                    {getClassificationLabel(move.classification)}
                  </div>
                  <div className="move-eval">
                    {getEvalDisplay(move.evaluation, move.mate)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
