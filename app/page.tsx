"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Difficulty = "easy" | "medium" | "hard" | "expert";
type Notes = Record<number, number[]>;
type Snapshot = { board: number[]; notes: Notes };

const DIFFICULTIES: Record<
  Difficulty,
  { label: string; clues: number; description: string }
> = {
  easy: { label: "简单", clues: 42, description: "轻松热身" },
  medium: { label: "中等", clues: 34, description: "稳步推理" },
  hard: { label: "困难", clues: 27, description: "进阶挑战" },
  expert: { label: "专家", clues: 21, description: "极限演绎" },
};

const BASE_SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179"
    .split("")
    .map(Number);

const EXPERT_PUZZLE =
  "500008000070000008000300500009000400400800001003000800000500200200010000000006070"
    .split("")
    .map(Number);

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

function makeSolution() {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rows = shuffle([0, 1, 2]).flatMap((group) =>
    shuffle([0, 1, 2]).map((row) => group * 3 + row),
  );
  const columns = shuffle([0, 1, 2]).flatMap((group) =>
    shuffle([0, 1, 2]).map((column) => group * 3 + column),
  );

  return rows.flatMap((row) =>
    columns.map((column) => digits[(row * 3 + Math.floor(row / 3) + column) % 9]),
  );
}

function makePuzzle(difficulty: Difficulty) {
  const solution = makeSolution();
  const puzzle = Array(81).fill(0);
  shuffle(Array.from({ length: 81 }, (_, index) => index))
    .slice(0, DIFFICULTIES[difficulty].clues)
    .forEach((index) => {
      puzzle[index] = solution[index];
    });
  return { puzzle, solution };
}

const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>("expert");
  const [solution, setSolution] = useState(BASE_SOLUTION);
  const [puzzle, setPuzzle] = useState(EXPERT_PUZZLE);
  const [board, setBoard] = useState(EXPERT_PUZZLE);
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState<Notes>({});
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [status, setStatus] = useState("选择一个空格开始");
  const [won, setWon] = useState(false);

  useEffect(() => {
    if (paused || won) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [paused, won]);

  const completed = useMemo(
    () => board.filter((value) => value !== 0).length,
    [board],
  );
  const selectedValue = selected === null ? 0 : board[selected];

  const startGame = useCallback((nextDifficulty: Difficulty = difficulty) => {
    const next = makePuzzle(nextDifficulty);
    setDifficulty(nextDifficulty);
    setSolution(next.solution);
    setPuzzle(next.puzzle);
    setBoard(next.puzzle);
    setSelected(null);
    setNotes({});
    setHistory([]);
    setMistakes(0);
    setSeconds(0);
    setPaused(false);
    setWon(false);
    setStatus(`${DIFFICULTIES[nextDifficulty].label}难度 · 选择一个空格开始`);
  }, [difficulty]);

  const pushHistory = useCallback(() => {
    setHistory((items) => [...items.slice(-39), { board: [...board], notes: { ...notes } }]);
  }, [board, notes]);

  const enterNumber = useCallback(
    (value: number) => {
      if (selected === null || puzzle[selected] !== 0 || paused || won) return;

      if (noteMode && value !== 0) {
        pushHistory();
        setNotes((current) => {
          const active = current[selected] ?? [];
          const next = active.includes(value)
            ? active.filter((number) => number !== value)
            : [...active, value].sort();
          return { ...current, [selected]: next };
        });
        setStatus(`候选数字 ${value} 已更新`);
        return;
      }

      if (value !== 0 && value !== solution[selected]) {
        setMistakes((count) => count + 1);
        setStatus(`${value} 不适合这个位置，再想一想`);
        return;
      }

      pushHistory();
      const nextBoard = [...board];
      nextBoard[selected] = value;
      setBoard(nextBoard);
      setNotes((current) => {
        const next = { ...current };
        delete next[selected];
        return next;
      });

      if (value === 0) {
        setStatus("已清除当前格");
      } else if (nextBoard.every((number, index) => number === solution[index])) {
        setWon(true);
        setStatus("完成！每一格都正确");
      } else {
        setStatus(`${value} 已填入`);
      }
    },
    [board, noteMode, paused, puzzle, pushHistory, selected, solution, won],
  );

  const undo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) {
      setStatus("还没有可撤销的操作");
      return;
    }
    setBoard(previous.board);
    setNotes(previous.notes);
    setHistory((items) => items.slice(0, -1));
    setWon(false);
    setStatus("已撤销上一步");
  }, [history]);

  const revealHint = useCallback(() => {
    const target =
      selected !== null && puzzle[selected] === 0 && board[selected] === 0
        ? selected
        : board.findIndex((value, index) => value === 0 && puzzle[index] === 0);
    if (target < 0 || paused || won) return;
    pushHistory();
    const next = [...board];
    next[target] = solution[target];
    setBoard(next);
    setSelected(target);
    setNotes((current) => {
      const updated = { ...current };
      delete updated[target];
      return updated;
    });
    setStatus("已揭示一个数字");
    if (next.every((number, index) => number === solution[index])) setWon(true);
  }, [board, paused, puzzle, pushHistory, selected, solution, won]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key >= "1" && event.key <= "9") enterNumber(Number(event.key));
      if (event.key === "Backspace" || event.key === "Delete") enterNumber(0);
      if (event.key.toLowerCase() === "n") setNoteMode((value) => !value);
      if (selected === null) return;
      const row = Math.floor(selected / 9);
      const column = selected % 9;
      const next = {
        ArrowUp: Math.max(0, row - 1) * 9 + column,
        ArrowDown: Math.min(8, row + 1) * 9 + column,
        ArrowLeft: row * 9 + Math.max(0, column - 1),
        ArrowRight: row * 9 + Math.min(8, column + 1),
      }[event.key];
      if (next !== undefined) {
        event.preventDefault();
        setSelected(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enterNumber, selected]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="九宫数独首页">
          <span className="brand-mark" aria-hidden="true">9·9</span>
          <span>九宫 <b>SUDOKU</b></span>
        </a>
        <p className="topbar-note">专注每一格</p>
        <button className="new-game-top" onClick={() => startGame()}>
          新游戏
        </button>
      </header>

      <section className="game-toolbar" aria-label="游戏状态">
        <label className="difficulty-field">
          <span>难度</span>
          <select
            value={difficulty}
            onChange={(event) => startGame(event.target.value as Difficulty)}
            aria-label="选择难度"
          >
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => (
              <option key={key} value={key}>{DIFFICULTIES[key].label}</option>
            ))}
          </select>
        </label>
        <span className="toolbar-divider" />
        <div className="timer">
          <span>用时</span>
          <strong>{formatTime(seconds)}</strong>
        </div>
        <button className="pause-button" onClick={() => setPaused((value) => !value)}>
          {paused ? "继续" : "暂停"}
        </button>
        <div className="progress-inline">
          <span>进度</span>
          <strong>{completed}/81</strong>
        </div>
      </section>

      <div className="game-layout">
        <aside className="info-rail" aria-label="本局信息">
          <p className="eyebrow">本局挑战</p>
          <h1>{DIFFICULTIES[difficulty].label}</h1>
          <p className="muted">{DIFFICULTIES[difficulty].description}</p>
          <div className="stat-block">
            <span>已完成</span>
            <strong>{Math.round((completed / 81) * 100)}%</strong>
            <div className="progress-track">
              <span style={{ width: `${(completed / 81) * 100}%` }} />
            </div>
          </div>
          <div className="stat-row">
            <span>错误</span>
            <strong>{mistakes}</strong>
          </div>
          <p className="shortcut">
            <kbd>1–9</kbd> 输入 · <kbd>N</kbd> 笔记
          </p>
        </aside>

        <section className="board-column">
          <div className="board-wrap">
            <div
              className={`sudoku-board ${paused ? "is-paused" : ""}`}
              role="grid"
              aria-label="9乘9数独棋盘"
            >
              {board.map((value, index) => {
                const row = Math.floor(index / 9);
                const column = index % 9;
                const selectedRow = selected === null ? -1 : Math.floor(selected / 9);
                const selectedColumn = selected === null ? -1 : selected % 9;
                const classes = [
                  "cell",
                  puzzle[index] !== 0 ? "given" : "editable",
                  selected !== null && (row === selectedRow || column === selectedColumn)
                    ? "in-cross"
                    : "",
                  selectedValue !== 0 && value === selectedValue ? "same-value" : "",
                  selected === index ? "selected-cell" : "",
                  column % 3 === 2 && column !== 8 ? "box-right" : "",
                  row % 3 === 2 && row !== 8 ? "box-bottom" : "",
                ].filter(Boolean).join(" ");

                return (
                  <button
                    key={index}
                    className={classes}
                    role="gridcell"
                    aria-label={`第 ${row + 1} 行第 ${column + 1} 列${
                      value ? `，数字 ${value}` : "，空格"
                    }`}
                    aria-selected={selected === index}
                    data-testid={`cell-${index}`}
                    onClick={() => {
                      if (!paused) {
                        setSelected(index);
                        setStatus(value ? `已选中数字 ${value}` : "选择一个数字填入");
                      }
                    }}
                  >
                    {value !== 0 ? (
                      <span>{value}</span>
                    ) : notes[index]?.length ? (
                      <span className="notes-grid">
                        {Array.from({ length: 9 }, (_, note) => (
                          <i key={note}>{notes[index]?.includes(note + 1) ? note + 1 : ""}</i>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {paused && (
                <button className="pause-overlay" onClick={() => setPaused(false)}>
                  <span>游戏已暂停</span>
                  <b>点击继续</b>
                </button>
              )}
            </div>
          </div>

          <div className="number-pad" aria-label="数字键盘">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                className={selectedValue === number ? "active" : ""}
                onClick={() => enterNumber(number)}
                aria-label={`填入数字 ${number}`}
              >
                {number}
              </button>
            ))}
            <button className="erase-key" onClick={() => enterNumber(0)} aria-label="清除">
              ×
            </button>
          </div>
          <p className="status-line" role="status" aria-live="polite">{status}</p>
        </section>

        <aside className="action-rail" aria-label="游戏操作">
          <p className="eyebrow">工具</p>
          <button onClick={undo} disabled={history.length === 0}>
            <span aria-hidden="true">↶</span><b>撤销</b><small>回到上一步</small>
          </button>
          <button
            className={noteMode ? "active-tool" : ""}
            onClick={() => {
              setNoteMode((value) => !value);
              setStatus(noteMode ? "笔记模式已关闭" : "笔记模式已开启");
            }}
          >
            <span aria-hidden="true">✎</span><b>笔记</b><small>{noteMode ? "当前已开启" : "记录候选数"}</small>
          </button>
          <button onClick={() => enterNumber(0)}>
            <span aria-hidden="true">⌫</span><b>擦除</b><small>清除当前格</small>
          </button>
          <button onClick={revealHint}>
            <span aria-hidden="true">?</span><b>提示</b><small>揭示一个数字</small>
          </button>
        </aside>
      </div>

      {won && (
        <div className="win-layer" role="dialog" aria-modal="true" aria-label="游戏完成">
          <div className="win-card">
            <span className="win-kicker">COMPLETED</span>
            <h2>漂亮，全部完成</h2>
            <p>用时 {formatTime(seconds)} · 错误 {mistakes} 次</p>
            <button onClick={() => startGame()}>再来一局</button>
          </div>
        </div>
      )}
    </main>
  );
}
