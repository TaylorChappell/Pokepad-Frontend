import type { BattleAction, BattleState, Fighter, Side } from './engine';
import { getPokemonStats } from '../data/stats';

export type BattleItem = 'potion' | 'revive' | 'full-heal';
export type BattleBag = Record<BattleItem, number>;
export interface BattleRules {
  items: 'none' | 'standard';
  levels: 'original' | 'level50';
}
export const DEFAULT_BATTLE_RULES: BattleRules = { items: 'standard', levels: 'original' };
export const BATTLE_ITEMS: Record<BattleItem, { name: string; description: string }> = {
  potion: { name: 'Potion', description: 'Restore 30% of maximum HP to a conscious Pokémon.' },
  revive: { name: 'Revive', description: 'Revive a fainted teammate with 50% HP.' },
  'full-heal': { name: 'Full Heal', description: 'Cure a conscious Pokémon’s status condition.' },
};
export function battleBag(rules: BattleRules): BattleBag {
  return rules.items === 'standard'
    ? { potion: 2, revive: 1, 'full-heal': 1 }
    : { potion: 0, revive: 0, 'full-heal': 0 };
}
export function prepareBattleTeam(team: Fighter[], rules: BattleRules): Fighter[] {
  return team.map((original) => {
    const fighter = structuredClone(original);
    if (rules.levels === 'level50') {
      const fraction = fighter.hp / fighter.stats.hp;
      fighter.level = 50;
      fighter.stats = getPokemonStats({ speciesId: fighter.speciesId, level: 50 });
      fighter.hp = Math.min(
        fighter.stats.hp,
        Math.max(fraction > 0 ? 1 : 0, Math.round(fraction * fighter.stats.hp)),
      );
      fighter.trainingScale = 1;
    }
    return fighter;
  });
}
export function legalBattleItem(
  state: BattleState,
  side: Side,
  item: BattleItem,
  index: number,
): boolean {
  const active = state[side][state.active[side]];
  const target = state[side][index];
  if (
    state.winner ||
    state.replacementRequired?.player ||
    state.replacementRequired?.rival ||
    !active ||
    active.hp <= 0 ||
    active.charging ||
    active.recharge ||
    !Number.isInteger(index) ||
    !target ||
    !state.bags?.[side]?.[item]
  )
    return false;
  if (item === 'revive') return target.hp === 0;
  if (target.hp <= 0) return false;
  return item === 'potion'
    ? target.hp < target.stats.hp
    : item === 'full-heal' && target.status !== 'none';
}
export function useBattleItem(
  state: BattleState,
  side: Side,
  item: BattleItem,
  index: number,
): boolean {
  if (!legalBattleItem(state, side, item, index)) return false;
  const target = state[side][index];
  state.bags![side][item]--;
  if (item === 'potion')
    target.hp = Math.min(
      target.stats.hp,
      target.hp + Math.max(1, Math.floor(target.stats.hp * 0.3)),
    );
  else if (item === 'revive') {
    target.hp = Math.max(1, Math.floor(target.stats.hp * 0.5));
    target.status = 'none';
    target.statusTurns = 0;
    target.trapped = 0;
    target.charging = null;
    target.recharge = false;
    target.stages = {
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
      accuracy: 0,
    };
  } else {
    target.status = 'none';
    target.statusTurns = 0;
  }
  return true;
}
export function chooseBattleItem(state: BattleState, side: Side): BattleAction | null {
  const active = state.active[side];
  if (
    state[side][active].hp / state[side][active].stats.hp <= 0.4 &&
    legalBattleItem(state, side, 'potion', active)
  )
    return { kind: 'item', item: 'potion', index: active };
  const fainted = state[side].findIndex((pokemon) => pokemon.hp === 0);
  if (legalBattleItem(state, side, 'revive', fainted))
    return { kind: 'item', item: 'revive', index: fainted };
  if (legalBattleItem(state, side, 'full-heal', active))
    return { kind: 'item', item: 'full-heal', index: active };
  return null;
}
