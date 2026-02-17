import { spawn, ChildProcess } from 'child_process';

export class StockfishEngine {
  private stockfish: ChildProcess | null = null;
  private ready: boolean = false;
  private queue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void; command: () => void }> = [];
  private processing: boolean = false;

  constructor() {
    this.startEngine();
  }

  private startEngine() {
    try {
      this.stockfish = spawn('/usr/games/stockfish');
      this.ready = false;

      this.stockfish.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('uciok')) {
          this.ready = true;
          console.log('Stockfish engine ready');
        }
      });

      this.stockfish.stderr?.on('data', (data: Buffer) => {
        console.error('Stockfish stderr:', data.toString());
      });

      this.stockfish.on('close', (code) => {
        console.error('Stockfish process closed with code:', code);
        this.ready = false;
        this.stockfish = null;
        
        // Reject all pending queue items
        while (this.queue.length > 0) {
          const item = this.queue.shift()!;
          item.reject(new Error('Stockfish process died'));
        }
        this.processing = false;
        
        // Restart engine after a short delay
        setTimeout(() => {
          console.log('Restarting Stockfish engine...');
          this.startEngine();
        }, 1000);
      });

      this.stockfish.on('error', (err) => {
        console.error('Stockfish process error:', err);
      });

      this.stockfish.stdin?.write('uci\n');
    } catch (err) {
      console.error('Failed to start Stockfish:', err);
    }
  }

  private ensureEngine(): boolean {
    return this.stockfish !== null && this.ready;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    if (!this.ensureEngine()) {
      // Engine not ready, reject current item and try restart
      const item = this.queue.shift()!;
      item.reject(new Error('Stockfish engine not ready'));
      this.processQueue();
      return;
    }
    
    this.processing = true;
    const item = this.queue.shift()!;
    try {
      item.command();
    } catch (e) {
      item.reject(e);
      this.processing = false;
      this.processQueue();
    }
  }

  private finishProcessing() {
    this.processing = false;
    this.processQueue();
  }

  async getBestMove(fen: string, skillLevel: number = 10): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = () => {
        if (!this.stockfish || !this.stockfish.stdout || !this.stockfish.stdin) {
          this.finishProcessing();
          return reject(new Error('Stockfish not available'));
        }

        const timeout = setTimeout(() => {
          this.stockfish?.stdout?.removeListener('data', dataHandler);
          this.finishProcessing();
          reject(new Error('Stockfish timeout'));
        }, 10000);

        const dataHandler = (data: Buffer) => {
          const output = data.toString();
          
          if (output.includes('bestmove')) {
            clearTimeout(timeout);
            this.stockfish?.stdout?.removeListener('data', dataHandler);
            
            const match = output.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
            if (match) {
              this.finishProcessing();
              resolve(match[1]);
            } else {
              this.finishProcessing();
              reject(new Error('No best move found'));
            }
          }
        };

        this.stockfish.stdout.on('data', dataHandler);
        
        this.stockfish.stdin.write(`setoption name Skill Level value ${skillLevel}\n`);
        this.stockfish.stdin.write(`position fen ${fen}\n`);
        this.stockfish.stdin.write('go movetime 1000\n');
      };

      this.queue.push({ resolve, reject, command });
      this.processQueue();
    });
  }

  async evaluatePosition(fen: string, depth: number = 15): Promise<{
    evaluation: number;
    bestMove: string;
    mate?: number;
  }> {
    return new Promise((resolve, reject) => {
      const command = () => {
        if (!this.stockfish || !this.stockfish.stdout || !this.stockfish.stdin) {
          this.finishProcessing();
          return reject(new Error('Stockfish not available'));
        }

        let evaluation = 0;
        let bestMove = '';
        let mate: number | undefined;
        
        const timeout = setTimeout(() => {
          this.stockfish?.stdout?.removeListener('data', dataHandler);
          this.finishProcessing();
          resolve({ evaluation: 0, bestMove: '', mate: undefined }); // Resolve with default instead of rejecting
        }, 10000);

        const dataHandler = (data: Buffer) => {
          const output = data.toString();
          const lines = output.split('\n');
          
          for (const line of lines) {
            if (line.includes('score cp')) {
              const match = line.match(/score cp (-?\d+)/);
              if (match) {
                evaluation = parseInt(match[1]) / 100;
              }
            }
            
            if (line.includes('score mate')) {
              const match = line.match(/score mate (-?\d+)/);
              if (match) {
                mate = parseInt(match[1]);
                evaluation = mate > 0 ? 100 : -100;
              }
            }
            
            if (line.includes('bestmove')) {
              clearTimeout(timeout);
              this.stockfish?.stdout?.removeListener('data', dataHandler);
              
              const match = line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
              if (match) {
                bestMove = match[1];
              }
              this.finishProcessing();
              resolve({ evaluation, bestMove, mate });
            }
          }
        };

        this.stockfish.stdout.on('data', dataHandler);
        
        this.stockfish.stdin.write(`position fen ${fen}\n`);
        this.stockfish.stdin.write(`go depth ${depth}\n`);
      };

      this.queue.push({ resolve, reject, command });
      this.processQueue();
    });
  }

  close() {
    this.stockfish?.kill();
  }
}

export const stockfishEngine = new StockfishEngine();
