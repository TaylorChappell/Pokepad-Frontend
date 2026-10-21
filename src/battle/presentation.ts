import { battleMove, type BattleEvent, type BattleState, type Side } from './engine';
import { pokemonById } from '../data/pokemon';

export type EffectFamily =
  | 'projectile'
  | 'beam'
  | 'claw'
  | 'impact'
  | 'sound'
  | 'vortex'
  | 'wave'
  | 'fangs'
  | 'vine'
  | 'powder'
  | 'ghost'
  | 'psychic'
  | 'electric'
  | 'speed'
  | 'recovery'
  | 'earth'
  | 'shield'
  | 'swords'
  | 'silk'
  | 'drain'
  | 'tongue';
export interface MovePresentation {
  family: EffectFamily;
  variant: string;
  color: string;
  accent: string;
  durationMs: number;
  target: 'opponent' | 'self';
}
type Definition = [EffectFamily, string, string, string, number?, 'self'?];
const definitions: Record<string, Definition> = {
  Swift: ['projectile', 'stars', '#ffe76a', '#fff8d9'],
  Recover: ['recovery', 'recover', '#5ce69a', '#e0fff0', 850, 'self'],
  Scratch: ['claw', 'scratch', '#fdf4cf', '#f06f71'],
  Tackle: ['impact', 'tackle', '#fff1b4', '#e89e65'],
  Growl: ['sound', 'growl', '#f6b36a', '#fff0c7'],
  Ember: ['projectile', 'embers', '#ff773e', '#ffe58b'],
  Flamethrower: ['beam', 'flame-stream', '#ff762c', '#fff195', 1000],
  'Fire Blast': ['projectile', 'fire-blast', '#ff5a30', '#ffe46c', 950],
  'Fire Spin': ['vortex', 'fire-spin', '#ff7d38', '#ffe385', 950],
  Slash: ['claw', 'slash', '#f9f5ff', '#9d85c9'],
  Fly: ['speed', 'dive', '#ddf9ff', '#74bddd'],
  'Water Gun': ['beam', 'water-jet', '#5cc8ff', '#d7f9ff'],
  Surf: ['wave', 'surf', '#2d9fe9', '#c6faff', 1000],
  'Hydro Pump': ['beam', 'hydro-pump', '#349eff', '#e0fbff', 1000],
  Bite: ['fangs', 'bite', '#fff5cf', '#735271'],
  'Ice Beam': ['beam', 'ice-beam', '#87eeff', '#ffffff', 900],
  'Vine Whip': ['vine', 'vine-whip', '#64bc59', '#d4ee86'],
  'Razor Leaf': ['projectile', 'leaves', '#65be4d', '#d8fa89'],
  'Solar Beam': ['beam', 'solar-beam', '#b9ea57', '#ffffcb', 1000],
  'Sleep Powder': ['powder', 'sleep-powder', '#8dd8e7', '#e5ffff', 850],
  Lick: ['tongue', 'lick', '#f48cae', '#ffdbeb'],
  'Night Shade': ['ghost', 'night-shade', '#8758cb', '#d7bcff', 900],
  Hypnosis: ['psychic', 'hypnosis', '#ea85df', '#fff1fc', 900],
  'Dream Eater': ['drain', 'dream-eater', '#b685ed', '#f2d9ff', 950],
  Psychic: ['psychic', 'psychic', '#e469c7', '#ffc7ed', 900],
  'Thunder Shock': ['electric', 'shock', '#ffe44c', '#fffce4'],
  Thunderbolt: ['electric', 'thunderbolt', '#ffd42a', '#fffdea', 900],
  'Thunder Wave': ['electric', 'thunder-wave', '#ffe56d', '#fff8c6', 850],
  'Quick Attack': ['speed', 'quick-attack', '#e7f6ff', '#9ed3e9', 650],
  'Body Slam': ['impact', 'body-slam', '#ffdba0', '#db8868', 850],
  Rest: ['recovery', 'rest', '#9bb5fb', '#ecf0ff', 850, 'self'],
  'Hyper Beam': ['beam', 'hyper-beam', '#ffbf57', '#fffdd7', 1100],
  'Dragon Rage': ['projectile', 'dragon-fire', '#8a82f1', '#e0b8ff', 950],
  Agility: ['speed', 'agility', '#94e6f2', '#eaffff', 750, 'self'],
  'Sand Attack': ['powder', 'sand', '#d5b57d', '#fff0c5'],
  'Double-Edge': ['impact', 'double-edge', '#ffeab1', '#f49e6e', 850],
  'Low Kick': ['impact', 'kick', '#f3bc85', '#fff1cf'],
  'Wing Attack': ['projectile', 'feathers', '#a9d7e9', '#f3fcff'],
  'Poison Sting': ['projectile', 'stingers', '#b982d1', '#ead2ff'],
  Earthquake: ['earth', 'earthquake', '#ae9564', '#e5d5a5', 950],
  'Rock Slide': ['earth', 'rock-slide', '#a79475', '#ddd0b4', 950],
  'Leech Life': ['drain', 'leech-life', '#a9cf54', '#eef7a3', 900],
  Confusion: ['psychic', 'confusion', '#e995dd', '#ffe5fb'],
  Harden: ['shield', 'harden', '#b8d4e8', '#f1fcff', 800, 'self'],
  'Swords Dance': ['swords', 'swords-dance', '#b8dbf0', '#fff2a4', 900, 'self'],
  'String Shot': ['silk', 'string-shot', '#eee9cf', '#ffffff'],
  'Poison Powder': ['powder', 'poison-powder', '#af7acb', '#edceff', 850],
  Struggle: ['impact', 'struggle', '#f6d4ac', '#ed9c94'],
};
export const PRESENTED_MOVES = Object.freeze(Object.keys(definitions));
const typeColors: Record<string, string> = {
  Fire: '#ff8b48',
  Water: '#64caff',
  Grass: '#9bdb68',
  Electric: '#ffe86b',
  Ice: '#a0efff',
  Psychic: '#ef9ce0',
  Ghost: '#ba9be6',
  Dragon: '#a7a0ef',
  Poison: '#c192da',
  Ground: '#d2b57e',
  Rock: '#c1b08e',
  Fighting: '#edb289',
  Bug: '#c8da81',
  Flying: '#b9dfef',
  Normal: '#f1dfb6',
};
/** Every currently playable move has a deliberately authored effect. The fallback is for future API moves. */
export function getMovePresentation(name: string): MovePresentation {
  const move = battleMove(name);
  const definition = definitions[name];
  if (definition) {
    const [family, variant, color, accent, durationMs = 780, self] = definition;
    return { family, variant, color, accent, durationMs, target: self ? 'self' : 'opponent' };
  }
  return {
    family: move.power ? 'projectile' : 'psychic',
    variant: 'future-move',
    color: typeColors[move.type] || '#e6d7ba',
    accent: '#ffffff',
    durationMs: 780,
    target: 'opponent',
  };
}
export interface BattleCue extends MovePresentation {
  id: string;
  kind: BattleEvent['kind'];
  side: Side;
  targetSide: Side;
  moveName?: string;
  outcome: 'hit' | 'miss' | 'immune' | 'charge';
  switchPhase?: 'recall' | 'sendout';
}
const opposite = (side: Side): Side => (side === 'player' ? 'rival' : 'player');
export function getBattleCue(
  event: BattleEvent,
  index = 0,
  events: BattleEvent[] = [event],
): BattleCue | null {
  const side = event.side || 'player';
  if (event.kind === 'item') {
    // Bench items remain in the dialogue; never put their effect on the active Pokémon.
    const active = event.frame?.[side][event.frame.active[side]];
    if (!active || event.itemTargetId !== active.id) return null;
    return {
      ...getMovePresentation('Recover'),
      id: `${index}-item`,
      kind: 'item',
      side,
      targetSide: side,
      moveName: 'Recover',
      outcome: 'hit',
    };
  }
  if (event.kind === 'move') {
    const name = event.moveName;
    if (!name) return null;
    const presentation = getMovePresentation(name);
    const tail = events.slice(index + 1);
    const boundary = tail.findIndex((entry) => entry.kind === 'move' || entry.kind === 'switch');
    const aftermath = boundary === -1 ? tail : tail.slice(0, boundary);
    const charge = event.movePhase === 'charge';
    const outcome = charge
      ? 'charge'
      : aftermath.find((entry) => entry.moveName === name && entry.side === side && entry.outcome)
          ?.outcome || 'hit';
    return {
      ...presentation,
      id: `${index}-${name}`,
      kind: 'move',
      side,
      targetSide:
        event.targetSide || (charge || presentation.target === 'self' ? side : opposite(side)),
      moveName: name,
      outcome,
    };
  }
  if (event.kind === 'switch' || event.kind === 'faint') {
    return {
      family: 'recovery',
      variant: event.kind,
      color: '#fff4ac',
      accent: '#ffffff',
      durationMs: 650,
      target: 'self',
      id: `${index}-${event.kind}`,
      kind: event.kind,
      side,
      targetSide: side,
      outcome: 'hit',
    };
  }
  return null;
}
export interface BattlePlaybackFrame {
  event: BattleEvent;
  cue: BattleCue | null;
  displayState: BattleState;
  durationMs: number;
  switch?: {
    phase: 'recall' | 'sendout';
    outgoingId: string;
    incomingId: string;
    forced: boolean;
  };
}
export const SWITCH_RECALL_MS = 600;
export const SWITCH_SENDOUT_MS = 1100;
/**
 * Replays the engine's ordered result without running combat a second time.
 * Switch snapshots retain the outgoing actor until recall ends. The incoming actor is
 * selected for the throw but is revealed only when the ball opens by the switch renderer.
 */
export function createBattlePlayback(
  previous: BattleState,
  next: BattleState,
): BattlePlaybackFrame[] {
  let display = structuredClone(previous);
  return next.events.flatMap((event, index): BattlePlaybackFrame[] => {
    const outgoing = event.kind === 'switch' ? structuredClone(display) : null;
    const cue = getBattleCue(event, index, next.events);
    if (event.frame) display = { ...display, ...structuredClone(event.frame) };
    display.events = [event];
    display.history = [
      ...previous.history,
      ...next.events.slice(0, index + 1).map(({ frame: _frame, ...entry }) => entry),
    ].slice(-80);
    const frame: BattlePlaybackFrame = {
      event,
      cue,
      displayState: structuredClone(display),
      durationMs:
        cue?.durationMs ||
        (event.kind === 'item'
          ? 850
          : event.kind === 'damage'
            ? 420
            : event.kind === 'result'
              ? 700
              : 540),
    };
    if (outgoing && cue) {
      const side = cue.side;
      const oldFighter = outgoing[side][outgoing.active[side]];
      const newFighter = display[side][display.active[side]];
      const forced = oldFighter.hp <= 0;
      const identity = { outgoingId: oldFighter.id, incomingId: newFighter.id, forced };
      const sendout: BattlePlaybackFrame = {
        ...frame,
        cue: {
          ...cue,
          id: cue.id + '-sendout',
          durationMs: SWITCH_SENDOUT_MS,
          switchPhase: 'sendout',
        },
        durationMs: SWITCH_SENDOUT_MS,
        switch: { ...identity, phase: 'sendout' },
      };
      if (forced) return [sendout];
      const recallEvent = {
        ...event,
        text:
          side === 'player'
            ? `${pokemonById(oldFighter.speciesId).name}, come back!`
            : `The opposing ${pokemonById(oldFighter.speciesId).name} was recalled.`,
      };
      outgoing.events = [recallEvent];
      return [
        {
          event: recallEvent,
          cue: {
            ...cue,
            id: cue.id + '-recall',
            durationMs: SWITCH_RECALL_MS,
            switchPhase: 'recall',
          },
          displayState: outgoing,
          durationMs: SWITCH_RECALL_MS,
          switch: { ...identity, phase: 'recall' },
        },
        sendout,
      ];
    }
    return [frame];
  });
}
