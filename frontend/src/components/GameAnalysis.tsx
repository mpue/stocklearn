import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { api } from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSwitcher } from './ThemeSwitcher';
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
  const { currentTheme } = useTheme();
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [game, setGame] = useState<Chess>(new Chess());
  const movesScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll move list to active move
  useEffect(() => {
    if (movesScrollRef.current && currentMoveIndex >= 0) {
      const activeEl = movesScrollRef.current.querySelector('.move-analysis-item.active') as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentMoveIndex]);

  useEffect(() => {
    if (gameId) {
      analyzeGame(gameId);
    }
  }, [gameId]);

  const analyzeGame = async (id: string) => {
    try {
      setLoading(true);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 Minuten Timeout
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3004'}/api/games/${id}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error('Failed to analyze game');
      }
      
      const result = await response.json();
      setAnalysis(result);
      setCurrentMoveIndex(-1);
      setGame(new Chess());
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Analysis timeout - took too long');
      } else {
        console.error('Error analyzing game:', error);
      }
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

  const previousMove = useCallback(() => {
    if (currentMoveIndex <= -1) return;
    goToMove(currentMoveIndex - 1);
  }, [currentMoveIndex, analysis]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!analysis) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentMoveIndex > -1) goToMove(currentMoveIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentMoveIndex < analysis.analysis.length - 1) goToMove(currentMoveIndex + 1);
          break;
        case 'Home':
          e.preventDefault();
          goToMove(-1);
          break;
        case 'End':
          e.preventDefault();
          goToMove(analysis.analysis.length - 1);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, analysis]);

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

  // Compute arrows and square highlights for move visualization
  const getCustomArrows = (): [string, string, string][] => {
    if (!currentAnalysis) return [];
    const arrows: [string, string, string][] = [];
    const bestFrom = currentAnalysis.bestMove?.substring(0, 2);
    const bestTo = currentAnalysis.bestMove?.substring(2, 4);
    const playedFrom = currentAnalysis.from;
    const playedTo = currentAnalysis.to;
    const isBestMove = bestFrom === playedFrom && bestTo === playedTo;

    if (isBestMove) {
      // Played move was the best — green arrow
      arrows.push([playedFrom, playedTo, 'rgba(0, 180, 0, 0.7)']);
    } else {
      // Played move — color based on classification
      const moveColor = getClassificationColor(currentAnalysis.classification);
      arrows.push([playedFrom, playedTo, moveColor]);
      // Best move — green arrow
      if (bestFrom && bestTo) {
        arrows.push([bestFrom, bestTo, 'rgba(0, 180, 0, 0.6)']);
      }
    }
    return arrows;
  };

  const getMoveSquareStyles = (): Record<string, React.CSSProperties> => {
    if (!currentAnalysis) return {};
    const styles: Record<string, React.CSSProperties> = {};
    const bestFrom = currentAnalysis.bestMove?.substring(0, 2);
    const bestTo = currentAnalysis.bestMove?.substring(2, 4);
    const isBestMove = bestFrom === currentAnalysis.from && bestTo === currentAnalysis.to;

    // Highlight played move squares
    styles[currentAnalysis.from] = {
      backgroundColor: isBestMove ? 'rgba(0, 180, 0, 0.3)' : 'rgba(255, 170, 0, 0.4)',
    };
    styles[currentAnalysis.to] = {
      backgroundColor: isBestMove ? 'rgba(0, 180, 0, 0.3)' : 'rgba(255, 170, 0, 0.4)',
    };

    return styles;
  };

  return (
    <div className="game-analysis">
      <div className="analysis-header">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Zurück zum Dashboard
        </button>
        <h1>📊 Spielanalyse</h1>
        <ThemeSwitcher />
      </div>

      <div className="analysis-container">
        <div className="board-section">
          <div className="board-wrapper">
            <Chessboard
              position={game.fen()}
              boardWidth={700}
              arePiecesDraggable={false}
              customArrowColor="rgba(0, 180, 0, 0.6)"
              customArrows={getCustomArrows()}
              customSquareStyles={getMoveSquareStyles()}
              customDarkSquareStyle={{ backgroundColor: currentTheme.board.darkSquare }}
              customLightSquareStyle={{ backgroundColor: currentTheme.board.lightSquare }}
              customBoardStyle={{
                borderRadius: '8px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
              }}
              customPieces={{
                wP: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/wP.svg`}
                    alt="wP"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                wN: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/wN.svg`}
                    alt="wN"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                wB: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/wB.svg`}
                    alt="wB"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                wR: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/wR.svg`}
                    alt="wR"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                wQ: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/wQ.svg`}
                    alt="wQ"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                wK: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/wK.svg`}
                    alt="wK"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                bP: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/bP.svg`}
                    alt="bP"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                bN: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/bN.svg`}
                    alt="bN"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                bB: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/bB.svg`}
                    alt="bB"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                bR: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/bR.svg`}
                    alt="bR"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                bQ: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/bQ.svg`}
                    alt="bQ"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
                bK: ({ squareWidth }) => (
                  <img
                    src={`${currentTheme.board.pieceStyle}/bK.svg`}
                    alt="bK"
                    style={{ width: squareWidth, height: squareWidth }}
                  />
                ),
              }}
            />
          </div>

          <div className="move-nav-bar">
            <div className="move-nav-buttons">
              <button onClick={() => goToMove(-1)} disabled={currentMoveIndex === -1} title="Start (Home)">⏮</button>
              <button onClick={previousMove} disabled={currentMoveIndex === -1} title="Zurück (←)">◀</button>
              <button onClick={nextMove} disabled={currentMoveIndex >= analysis.analysis.length - 1} title="Vor (→)">▶</button>
              <button onClick={() => goToMove(analysis.analysis.length - 1)} disabled={currentMoveIndex === analysis.analysis.length - 1} title="Ende (End)">⏭</button>
            </div>
            <input
              type="range"
              className="move-slider"
              min={-1}
              max={analysis.analysis.length - 1}
              value={currentMoveIndex}
              onChange={(e) => goToMove(parseInt(e.target.value))}
            />
            <span className="move-counter">
              {currentMoveIndex >= 0 ? currentMoveIndex + 1 : 0} / {analysis.analysis.length}
            </span>
          </div>

          <div className="eval-chart">
            <div className="chart-container" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const ratio = x / rect.width;
              const idx = Math.round(ratio * (analysis.analysis.length - 1));
              goToMove(Math.max(0, Math.min(idx, analysis.analysis.length - 1)));
            }}>
              <div className="chart-side-label white-label">Weiß</div>
              <div className="chart-side-label black-label">Schwarz</div>
              <svg viewBox="0 0 400 120" className="eval-svg" preserveAspectRatio="none">
                {/* White background = white's area */}
                <rect x="0" y="0" width="400" height="120" fill="white" />
                {/* Dark polygon from top edge down to eval line = black's area */}
                {(() => {
                  const len = Math.max(1, analysis.analysis.length - 1);
                  const evalPoints = analysis.analysis.map((move, i) => {
                    const x = (i / len) * 400;
                    const clamped = Math.max(-5, Math.min(5, move.evaluation));
                    const y = 60 - (clamped / 5) * 55;
                    return `${x},${y}`;
                  });
                  const d = `M0,0 L${evalPoints.join(' L')} L400,0 Z`;
                  return <path d={d} fill="#333" />;
                })()}
                {/* Center line */}
                <line x1="0" y1="60" x2="400" y2="60" stroke="rgba(128,128,128,0.4)" strokeWidth="0.5" strokeDasharray="4,4" />
                {/* Current position indicator */}
                {currentMoveIndex >= 0 && (
                  <line
                    x1={(currentMoveIndex / Math.max(1, analysis.analysis.length - 1)) * 400}
                    y1="0"
                    x2={(currentMoveIndex / Math.max(1, analysis.analysis.length - 1)) * 400}
                    y2="120"
                    stroke="rgba(255,50,50,0.8)"
                    strokeWidth="1.5"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>

        <div className="analysis-sidebar">
          {currentAnalysis && (() => {
            const bestFrom = currentAnalysis.bestMove?.substring(0, 2);
            const bestTo = currentAnalysis.bestMove?.substring(2, 4);
            const isBestMove = bestFrom === currentAnalysis.from && bestTo === currentAnalysis.to;
            return (
            <div className={`current-move-info ${isBestMove ? 'best-move-played' : ''}`}>
              <div className="move-header">
                <h3>Zug {Math.floor(currentAnalysis.moveNumber / 2) + 1}: {currentAnalysis.move}</h3>
                <span
                  className="classification-badge"
                  style={{ backgroundColor: isBestMove ? '#28a745' : getClassificationColor(currentAnalysis.classification) }}
                >
                  {isBestMove ? '✓ BESTER ZUG' : `${currentAnalysis.classification.toUpperCase()} ${getClassificationLabel(currentAnalysis.classification)}`}
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
                {!isBestMove && (
                  <div className="eval-item">
                    <strong>Bester Zug:</strong>
                    <span className="best-move-text">{currentAnalysis.bestMove} ({getEvalDisplay(currentAnalysis.bestMoveEval)})</span>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

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

          <div className="moves-list-analysis">
            <h3>Züge</h3>
            <div className="moves-scroll" ref={movesScrollRef}>
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
