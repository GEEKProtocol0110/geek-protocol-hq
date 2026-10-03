import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryPairs, createMemoryGame, flipMemoryCard, closeMemoryComparison } from '../public/memory/assets/memory-model.js';

test('each supported memory board has unique words and meanings, exactly two cards per concept', () => {
  for (const count of [4, 6, 8]) {
    const game = createMemoryGame(count, () => 0.4);
    assert.equal(game.cards.length, count * 2);
    assert.equal(new Set(game.cards.map(card => card.id)).size, count * 2);
    const concepts = new Set(game.cards.map(card => card.pairId)); assert.equal(concepts.size, count);
    for (const id of concepts) assert.deepEqual(game.cards.filter(card => card.pairId === id).map(card => card.kind).sort(), ['meaning', 'word']);
    assert.equal(new Set(game.cards.map(card => card.text)).size, count * 2);
  }
  for (const count of [0, 3, 5, 9, '4']) assert.throws(() => createMemoryGame(count), RangeError);
  assert.equal(memoryPairs.length, 8);
  for (const pair of memoryPairs) { assert.equal(new URL(pair.source).protocol, 'https:'); assert.ok(pair.explanation && pair.topic); }
});

test('a mismatch waits for the player and prevents rapid extra flips or duplicate attempts', () => {
  const start = createMemoryGame(4), a = start.cards[0], b = start.cards.find(card => card.pairId !== a.pairId);
  const one = flipMemoryCard(start, a.id);
  assert.equal(flipMemoryCard(one, a.id), one); assert.equal(one.moves, 0);
  const two = flipMemoryCard(one, b.id); assert.equal(two.phase, 'compare'); assert.equal(two.moves, 1);
  for (const card of two.cards) assert.equal(flipMemoryCard(two, card.id), two);
  const closed = closeMemoryComparison(two); assert.equal(closed.phase, 'playing'); assert.deepEqual(closed.revealed, []); assert.equal(closed.moves, 1);
  assert.deepEqual(start.revealed, []); assert.equal(start.moves, 0);
});

test('matched cards cannot be reused, completion fires once, and a new board starts clean', () => {
  let game = createMemoryGame(8);
  for (const pairId of new Set(game.cards.map(card => card.pairId))) {
    const [a, b] = game.cards.filter(card => card.pairId === pairId);
    game = flipMemoryCard(flipMemoryCard(game, a.id), b.id);
    const previous = game; assert.equal(flipMemoryCard(game, a.id), previous); assert.equal(flipMemoryCard(game, b.id), previous);
  }
  assert.equal(game.phase, 'complete'); assert.equal(game.moves, 8); assert.equal(game.matched.length, 16);
  assert.equal(closeMemoryComparison(game), game); assert.equal(flipMemoryCard(game, 500), game);
  const fresh = createMemoryGame(4); assert.equal(fresh.phase, 'playing'); assert.equal(fresh.moves, 0); assert.deepEqual(fresh.matched, []);
});
