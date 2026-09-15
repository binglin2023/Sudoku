"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createUniquePuzzle } from "@/lib/sudoku";

type Difficulty = "easy" | "medium" | "hard" | "expert";
type Notes = Record<number, number[]>;
type Snapshot = { board: number[]; notes: Notes };
type CurrentGameSave = {
  version: 1;
  difficulty: Difficulty;
  solution: number[];
  puzzle: number[];
  board: number[];
  selected: number | null;
  notes: Notes;
  undoHistory: Snapshot[];
  mistakes: number;
  seconds: number;
  paused: boolean;
  noteMode: boolean;
  status: string;
  won: boolean;
};
type GameRecord = {
  id: string;
  finishedAt: string;
  difficulty: Difficulty;
  puzzle: number[];
  board: number[];
  seconds: number;
  mistakes: number;
};

const HISTORY_KEY = "jiugong-sudoku-history-v1";
const CURRENT_GAME_KEY = "jiugong-sudoku-current-game-v1";
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
  "162857493534129678789643521475312986913586742628794135356478219241935867897261354"
    .split("")
    .map(Number);

const EXPERT_PUZZLE =
  "100007090030020008009600500005300900010080002600004000300000010040000007007000300"
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
  const puzzle = createUniquePuzzle(solution, DIFFICULTIES[difficulty].clues);
  return { puzzle, solution };
}

const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const isBoard = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === 81 &&
  value.every(
    (cell) => Number.isInteger(cell) && Number(cell) >= 0 && Number(cell) <= 9,
  );

const isNotes = (value: unknown): value is Notes => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([index, candidates]) => {
    const cell = Number(index);
    return (
      Number.isInteger(cell) &&
      cell >= 0 &&
      cell < 81 &&
      Array.isArray(candidates) &&
      candidates.every(
        (candidate) =>
          Number.isInteger(candidate) && candidate >= 1 && candidate <= 9,
      )
    );
  });
};

const isCurrentGameSave = (value: unknown): value is CurrentGameSave => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const save = value as Partial<CurrentGameSave>;
  if (
    save.version !== 1 ||
    !save.difficulty ||
    !(save.difficulty in DIFFICULTIES) ||
    !isBoard(save.solution) ||
    !isBoard(save.puzzle) ||
    !isBoard(save.board) ||
    !isNotes(save.notes) ||
    !Array.isArray(save.undoHistory) ||
    !save.undoHistory.every(
      (snapshot) =>
        snapshot && isBoard(snapshot.board) && isNotes(snapshot.notes),
    ) ||
    !Number.isInteger(save.mistakes) ||
    Number(save.mistakes) < 0 ||
    !Number.isInteger(save.seconds) ||
    Number(save.seconds) < 0 ||
    typeof save.paused !== "boolean" ||
    typeof save.noteMode !== "boolean" ||
    typeof save.status !== "string" ||
    typeof save.won !== "boolean"
  ) return false;

  if (
    save.selected !== null &&
    (!Number.isInteger(save.selected) || Number(save.selected) < 0 || Number(save.selected) >= 81)
  ) return false;

  return save.puzzle.every(
    (given, index) =>
      (given === 0 || given === save.solution?.[index]) &&
      (given === 0 || given === save.board?.[index]),
  );
};

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>("expert");
  const [solution, setSolution] = useState(BASE_SOLUTION);
  const [puzzle, setPuzzle] = useState(EXPERT_PUZZLE);
  const [board, setBoard] = useState(EXPERT_PUZZLE);
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState<Notes>({});
  const [undoHistory, setUndoHistory] = useState<Snapshot[]>([]);
  const [savedGames, setSavedGames] = useState<GameRecord[]>([]);
  const [reviewing, setReviewing] = useState<GameRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [status, setStatus] = useState("选择一个空格开始");
  const [won, setWon] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const records = JSON.parse(raw) as GameRecord[];
      if (Array.isArray(records)) {
        setSavedGames(
          records.filter(
            (record) =>
              record &&
              Array.isArray(record.puzzle) &&
              record.puzzle.length === 81 &&
              Array.isArray(record.board) &&
              record.board.length === 81 &&
              record.difficulty in DIFFICULTIES,
          ),
        );
      }
    } catch {
      try {
        window.localStorage.removeItem(HISTORY_KEY);
      } catch {}
    }

    try {
      const raw = window.localStorage.getItem(CURRENT_GAME_KEY);
      if (raw) {
        const save: unknown = JSON.parse(raw);
        if (isCurrentGameSave(save)) {
          setDifficulty(save.difficulty);
          setSolution(save.solution);
          setPuzzle(save.puzzle);
          setBoard(save.board);
          setSelected(save.selected);
          setNotes(save.notes);
          setUndoHistory(save.undoHistory.slice(-40));
          setMistakes(save.mistakes);
          setSeconds(save.seconds);
          setPaused(save.paused);
          setNoteMode(save.noteMode);
          setStatus(save.status);
          setWon(save.won);
        } else {
          window.localStorage.removeItem(CURRENT_GAME_KEY);
        }
      }
    } catch {
      try {
        window.localStorage.removeItem(CURRENT_GAME_KEY);
      } catch {}
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady || reviewing) return;
    const save: CurrentGameSave = {
      version: 1,
      difficulty,
      solution,
      puzzle,
      board,
      selected,
      notes,
      undoHistory,
      mistakes,
      seconds,
      paused,
      noteMode,
      status,
      won,
    };
    try {
      window.localStorage.setItem(CURRENT_GAME_KEY, JSON.stringify(save));
    } catch {}
  }, [
    board,
    difficulty,
    mistakes,
    noteMode,
    notes,
    paused,
    puzzle,
    reviewing,
    seconds,
    selected,
    solution,
    status,
    storageReady,
    undoHistory,
    won,
  ]);

  useEffect(() => {
    if (!storageReady || paused || won || reviewing || historyOpen) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [historyOpen, paused, reviewing, storageReady, won]);

  const activeBoard = reviewing?.board ?? board;
  const activePuzzle = reviewing?.puzzle ?? puzzle;
  const activeDifficulty = reviewing?.difficulty ?? difficulty;
  const activeMistakes = reviewing?.mistakes ?? mistakes;
  const activeSeconds = reviewing?.seconds ?? seconds;
  const completed = useMemo(
    () => activeBoard.filter((value) => value !== 0).length,
    [activeBoard],
  );
  const remainingCounts = useMemo(() => {
    const counts = Array(10).fill(9);
    board.forEach((value) => {
      if (value !== 0) counts[value] -= 1;
    });
    return counts;
  }, [board]);
  const selectedValue = selected === null ? 0 : activeBoard[selected];

  const startGame = useCallback((nextDifficulty: Difficulty = difficulty) => {
    const next = makePuzzle(nextDifficulty);
    setDifficulty(nextDifficulty);
    setSolution(next.solution);
    setPuzzle(next.puzzle);
    setBoard(next.puzzle);
    setSelected(null);
    setNotes({});
    setUndoHistory([]);
    setMistakes(0);
    setSeconds(0);
    setPaused(false);
    setWon(false);
    setReviewing(null);
    setHistoryOpen(false);
    setStatus(`${DIFFICULTIES[nextDifficulty].label}难度 · 选择一个空格开始`);
  }, [difficulty]);

  const pushHistory = useCallback(() => {
    setUndoHistory((items) => [
      ...items.slice(-39),
      { board: [...board], notes: { ...notes } },
    ]);
  }, [board, notes]);

  const finishGame = useCallback(
    (finalBoard: number[]) => {
      const record: GameRecord = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        finishedAt: new Date().toISOString(),
        difficulty,
        puzzle: [...puzzle],
        board: [...finalBoard],
        seconds,
        mistakes,
      };
      setSavedGames((items) => {
        const next = [record, ...items].slice(0, 30);
        try {
          window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      setWon(true);
      setStatus("完成！每一格都与关卡答案一致");
    },
    [difficulty, mistakes, puzzle, seconds],
  );

  const enterNumber = useCallback(
    (value: number) => {
      if (
        reviewing ||
        selected === null ||
        puzzle[selected] !== 0 ||
        paused ||
        won
      ) return;
      if (value !== 0 && remainingCounts[value] === 0) return;

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

        // 清除同一行、同一列、同一九宫格内所有冲突的笔记
        if (value !== 0) {
          const selectedRow = Math.floor(selected / 9);
          const selectedCol = selected % 9;
          const selectedBox =
            Math.floor(selectedRow / 3) * 3 + Math.floor(selectedCol / 3);

          for (let i = 0; i < 81; i++) {
            const cellRow = Math.floor(i / 9);
            const cellCol = i % 9;
            const cellBox =
              Math.floor(cellRow / 3) * 3 + Math.floor(cellCol / 3);

            if (
              i !== selected &&
              (cellRow === selectedRow ||
                cellCol === selectedCol ||
                cellBox === selectedBox)
            ) {
              const cellNotes = next[i];
              if (cellNotes && cellNotes.includes(value)) {
                const filtered = cellNotes.filter((n) => n !== value);
                if (filtered.length > 0) {
                  next[i] = filtered;
                } else {
                  delete next[i];
                }
              }
            }
          }
        }

        return next;
      });

      if (value === 0) {
        setStatus("已清除当前格");
      } else if (nextBoard.every((number, index) => number === solution[index])) {
        finishGame(nextBoard);
      } else {
        setStatus(`${value} 已填入`);
      }
    },
    [
      board,
      finishGame,
      noteMode,
      paused,
      puzzle,
      pushHistory,
      remainingCounts,
      reviewing,
      selected,
      solution,
      won,
    ],
  );

  const undo = useCallback(() => {
    const previous = undoHistory[undoHistory.length - 1];
    if (!previous) {
      setStatus("还没有可撤销的操作");
      return;
    }
    setBoard(previous.board);
    setNotes(previous.notes);
    setUndoHistory((items) => items.slice(0, -1));
    setWon(false);
    setStatus("已撤销上一步");
  }, [undoHistory]);

  const revealHint = useCallback(() => {
    if (reviewing || paused || won) return;
    const target =
      selected !== null && puzzle[selected] === 0 && board[selected] === 0
        ? selected
        : board.findIndex((value, index) => value === 0 && puzzle[index] === 0);
    if (target < 0) return;
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
    if (next.every((number, index) => number === solution[index])) finishGame(next);
  }, [board, finishGame, paused, puzzle, pushHistory, reviewing, selected, solution, won]);

  const openReview = useCallback((record: GameRecord) => {
    setReviewing(record);
    setHistoryOpen(false);
    setWon(false);
    setSelected(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (historyOpen) setHistoryOpen(false);
        else if (reviewing) {
          setReviewing(null);
          setSelected(null);
        }
      }
      if (event.key >= "1" && event.key <= "9") enterNumber(Number(event.key));
      if (event.key === "Backspace" || event.key === "Delete") enterNumber(0);
      if (event.key.toLowerCase() === "n" && !reviewing) {
        setNoteMode((value) => !value);
      }
      if (event.key.toLowerCase() === "p"){
        setPaused((value) => !value);
      }
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
  }, [enterNumber, historyOpen, reviewing, selected]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="九宫数独首页">
          <span className="brand-mark" aria-hidden="true">9·9</span>
          <span>九宫 <b>SUDOKU</b></span>
        </a>
        <p className="topbar-note">专注每一格</p>
        <div className="topbar-actions">
          <button className="history-button" onClick={() => setHistoryOpen(true)}>
            历史关卡{savedGames.length > 0 ? ` ${savedGames.length}` : ""}
          </button>
          <button className="new-game-top" onClick={() => startGame()}>
            新游戏
          </button>
        </div>
      </header>

      <section className="game-toolbar" aria-label="游戏状态">
        {reviewing ? (
          <>
            <div className="review-toolbar-copy">
              <span>历史复盘</span>
              <strong>{formatDate(reviewing.finishedAt)}</strong>
            </div>
            <span className="toolbar-divider" />
            <div className="timer"><span>用时</span><strong>{formatTime(activeSeconds)}</strong></div>
            <button className="pause-button" onClick={() => { setReviewing(null); setSelected(null); }}>退出复盘</button>
          </>
        ) : (
          <>
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
            <div className="timer"><span>用时</span><strong>{formatTime(seconds)}</strong></div>
            <button className="pause-button" onClick={() => setPaused((value) => !value)}>
              {paused ? "继续" : "暂停"}
            </button>
            <div className="progress-inline"><span>进度</span><strong>{completed}/81</strong></div>
          </>
        )}
      </section>

      <div className="game-layout">
        <aside className="info-rail" aria-label="本局信息">
          <p className="eyebrow">{reviewing ? "历史记录" : "本局挑战"}</p>
          <h1>{DIFFICULTIES[activeDifficulty].label}</h1>
          <p className="muted">{reviewing ? "已完成 · 只读复盘" : DIFFICULTIES[difficulty].description}</p>
          <div className="stat-block">
            <span>已完成</span><strong>{Math.round((completed / 81) * 100)}%</strong>
            <div className="progress-track"><span style={{ width: `${(completed / 81) * 100}%` }} /></div>
          </div>
          <div className="stat-row"><span>错误</span><strong>{activeMistakes}</strong></div>
          <p className="shortcut">
            {reviewing ? "点击任意数字可查看关联位置" : <><kbd>1–9</kbd> 输入 · <kbd>N</kbd> 笔记</>}
          </p>
        </aside>

        <section className="board-column">
          <div className="board-wrap">
            <div className={`sudoku-board ${paused ? "is-paused" : ""}`} role="grid" aria-label={reviewing ? "历史关卡复盘棋盘" : "9乘9数独棋盘"}>
              {activeBoard.map((value, index) => {
                const row = Math.floor(index / 9);
                const column = index % 9;
                const selectedRow = selected === null ? -1 : Math.floor(selected / 9);
                const selectedColumn = selected === null ? -1 : selected % 9;
                const classes = [
                  "cell",
                  activePuzzle[index] !== 0 ? "given" : "editable",
                  reviewing ? "review-cell" : "",
                  selected !== null && (row === selectedRow || column === selectedColumn) ? "in-cross" : "",
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
                    aria-label={`第 ${row + 1} 行第 ${column + 1} 列${value ? `，数字 ${value}` : "，空格"}`}
                    aria-selected={selected === index}
                    data-testid={`cell-${index}`}
                    onClick={() => {
                      if (!paused || reviewing) {
                        setSelected(index);
                        setStatus(value ? `已选中数字 ${value}` : "选择一个数字填入");
                      }
                    }}
                  >
                    {value !== 0 ? <span>{value}</span> : notes[index]?.length && !reviewing ? (
                      <span className="notes-grid">
                        {Array.from({ length: 9 }, (_, note) => (
                          <i key={note}>{notes[index]?.includes(note + 1) ? note + 1 : ""}</i>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {paused && !reviewing && (
                <button className="pause-overlay" onClick={() => setPaused(false)}>
                  <span>游戏已暂停</span><b>点击继续</b>
                </button>
              )}
            </div>
          </div>

          {reviewing ? (
            <div className="review-summary">
              <span><i className="legend-given">8</i> 原始数字</span>
              <span><i className="legend-filled">8</i> 最终填入</span>
              <strong>{formatTime(reviewing.seconds)}</strong>
            </div>
          ) : (
            <div className="number-pad" aria-label="数字键盘">
              {Array.from({ length: 9 }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  className={selectedValue === number ? "active" : ""}
                  onClick={() => enterNumber(number)}
                  aria-label={`填入数字 ${number}，剩余 ${remainingCounts[number]} 个`}
                  disabled={remainingCounts[number] === 0}
                >
                  <span>{number}</span>
                  <small>{remainingCounts[number] === 0 ? "完成" : `剩 ${remainingCounts[number]}`}</small>
                </button>
              ))}
              <button className="erase-key" onClick={() => enterNumber(0)} aria-label="清除">×</button>
            </div>
          )}
          <p className="status-line" role="status" aria-live="polite">
            {reviewing ? "复盘模式：粗体为原始题目，常规字重为你的最终答案" : status}
          </p>
        </section>

        <aside className="action-rail" aria-label={reviewing ? "复盘操作" : "游戏操作"}>
          <p className="eyebrow">{reviewing ? "复盘" : "工具"}</p>
          {reviewing ? (
            <>
              <div className="review-detail"><span aria-hidden="true">✓</span><b>标准答案</b><small>与关卡答案一致</small></div>
              <div className="review-detail"><span aria-hidden="true">◷</span><b>{formatTime(reviewing.seconds)}</b><small>完成用时</small></div>
              <div className="review-detail"><span aria-hidden="true">×</span><b>{reviewing.mistakes} 次</b><small>冲突次数</small></div>
              <button onClick={() => { setReviewing(null); setSelected(null); }}><span aria-hidden="true">←</span><b>返回游戏</b><small>退出历史复盘</small></button>
            </>
          ) : (
            <>
              <button onClick={undo} disabled={undoHistory.length === 0}><span aria-hidden="true">↶</span><b>撤销</b><small>回到上一步</small></button>
              <button className={noteMode ? "active-tool" : ""} onClick={() => { setNoteMode((value) => !value); setStatus(noteMode ? "笔记模式已关闭" : "笔记模式已开启"); }}>
                <span aria-hidden="true">✎</span><b>笔记</b><small>{noteMode ? "当前已开启" : "记录候选数"}</small>
              </button>
              <button onClick={() => enterNumber(0)}><span aria-hidden="true">⌫</span><b>擦除</b><small>清除当前格</small></button>
              <button onClick={revealHint}><span aria-hidden="true">?</span><b>提示</b><small>揭示标准答案</small></button>
            </>
          )}
        </aside>
      </div>

      {historyOpen && (
        <div className="history-layer" role="dialog" aria-modal="true" aria-label="历史关卡">
          <section className="history-panel">
            <header>
              <div><span className="win-kicker">GAME ARCHIVE</span><h2>历史关卡</h2></div>
              <button onClick={() => setHistoryOpen(false)} aria-label="关闭历史关卡">×</button>
            </header>
            {savedGames.length === 0 ? (
              <div className="history-empty"><b>还没有完成记录</b><p>完成一局后，题面和最终答案会自动保存在这里。</p></div>
            ) : (
              <div className="history-list">
                {savedGames.map((record, index) => (
                  <button key={record.id} className="history-item" onClick={() => openReview(record)}>
                    <span className="history-index">{String(savedGames.length - index).padStart(2, "0")}</span>
                    <span><b>{DIFFICULTIES[record.difficulty].label}关卡</b><small>{formatDate(record.finishedAt)}</small></span>
                    <span><b>{formatTime(record.seconds)}</b><small>错误 {record.mistakes}</small></span>
                    <strong>复盘 →</strong>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {won && (
        <div className="win-layer" role="dialog" aria-modal="true" aria-label="游戏完成">
          <div className="win-card">
            <span className="win-kicker">COMPLETED</span>
            <h2>漂亮，全部正确</h2>
            <p>用时 {formatTime(seconds)} · 冲突 {mistakes} 次</p>
            <div className="win-actions">
              <button className="secondary" onClick={() => savedGames[0] && openReview(savedGames[0])}>立即复盘</button>
              <button onClick={() => startGame()}>再来一局</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
