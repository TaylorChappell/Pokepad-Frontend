import { asset } from '../utils';
const sprites = {
  berry: 'sitrus-berry',
  potion: 'potion',
  revive: 'revive',
  'full-heal': 'full-heal',
} as const;
export function ItemSprite({ item, size = 40 }: { item: keyof typeof sprites; size?: number }) {
  return (
    <img
      className="item-sprite"
      src={asset('pixel/items/' + sprites[item] + '.png')}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
