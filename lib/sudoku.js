const ALL_DIGITS_MASK = 0b1111111110;

function boxOf(index) {
  const row = Math.floor(index / 9);
  const column = index % 9;
  return Math.floor(row / 3) * 3 + Math.floor(column / 3);
}

function bitCount(value) {
  let count = 0;
  while (value) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

/**
 * Count Sudoku solutions, stopping as soon as `limit` solutions are found.
 * The early exit is important when this function is called repeatedly while
 * carving a puzzle: we only need to distinguish 0, 1, and 2-or-more answers.
 *
 * @param {number[]} input
 * @param {number} [limit]
 */
export function countSolutions(input, limit = 2) {
  if (input.length !== 81 || limit < 1) return 0;

  const rowMasks = new Uint16Array(9);
  const columnMasks = new Uint16Array(9);
  const boxMasks = new Uint16Array(9);
  const emptyCells = [];

  for (let index = 0; index < 81; index += 1) {
    const value = input[index];
    if (value === 0) {
      emptyCells.push(index);
      continue;
    }
    if (!Number.isInteger(value) || value < 1 || value > 9) return 0;

    const row = Math.floor(index / 9);
    const column = index % 9;
    const box = boxOf(index);
    const bit = 1 << value;
    if ((rowMasks[row] | columnMasks[column] | boxMasks[box]) & bit) return 0;
    rowMasks[row] |= bit;
    columnMasks[column] |= bit;
    boxMasks[box] |= bit;
  }

  let solutions = 0;

  const search = (depth) => {
    if (solutions >= limit) return;
    if (depth === emptyCells.length) {
      solutions += 1;
      return;
    }

    // MRV: solve the cell with the fewest candidates first. This makes the
    // repeated uniqueness checks fast enough to run when a new game starts.
    let bestPosition = depth;
    let bestCount = 10;
    for (let position = depth; position < emptyCells.length; position += 1) {
      const index = emptyCells[position];
      const row = Math.floor(index / 9);
      const column = index % 9;
      const box = boxOf(index);
      const mask = ALL_DIGITS_MASK & ~(rowMasks[row] | columnMasks[column] | boxMasks[box]);
      const candidateCount = bitCount(mask);
      if (candidateCount === 0) return;
      if (candidateCount < bestCount) {
        bestCount = candidateCount;
        bestPosition = position;
        if (candidateCount === 1) break;
      }
    }

    [emptyCells[depth], emptyCells[bestPosition]] = [
      emptyCells[bestPosition],
      emptyCells[depth],
    ];

    const index = emptyCells[depth];
    const row = Math.floor(index / 9);
    const column = index % 9;
    const box = boxOf(index);
    let mask = ALL_DIGITS_MASK & ~(rowMasks[row] | columnMasks[column] | boxMasks[box]);

    while (mask && solutions < limit) {
      const bit = mask & -mask;
      rowMasks[row] |= bit;
      columnMasks[column] |= bit;
      boxMasks[box] |= bit;
      search(depth + 1);
      rowMasks[row] ^= bit;
      columnMasks[column] ^= bit;
      boxMasks[box] ^= bit;
      mask ^= bit;
    }

    [emptyCells[depth], emptyCells[bestPosition]] = [
      emptyCells[bestPosition],
      emptyCells[depth],
    ];
  };

  search(0);
  return solutions;
}

/**
 * Remove clues only when the resulting puzzle still has exactly one solution.
 * `targetClues` is a goal, not permission to break uniqueness: if no more
 * clues can safely be removed, the function returns a slightly fuller puzzle.
 *
 * @param {number[]} solution
 * @param {number} targetClues
 * @param {() => number} [random]
 */
export function createUniquePuzzle(solution, targetClues, random = Math.random) {
  if (countSolutions(solution, 2) !== 1) {
    throw new Error("A valid completed Sudoku is required");
  }

  const puzzle = [...solution];
  const positions = Array.from({ length: 81 }, (_, index) => index);
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [positions[index], positions[swap]] = [positions[swap], positions[index]];
  }

  let clues = 81;
  for (const position of positions) {
    if (clues <= targetClues) break;
    const previous = puzzle[position];
    puzzle[position] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      clues -= 1;
    } else {
      puzzle[position] = previous;
    }
  }

  return puzzle;
}
