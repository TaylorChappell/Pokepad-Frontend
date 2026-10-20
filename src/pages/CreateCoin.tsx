import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Avatar, Button, EggArt, PackArt, PokemonArt, TypeChip } from '../components/UI';
import { pokemonById } from '../data/pokemon';
import { useApp } from '../state/AppContext';
import { profileName } from '../state/model';
import { navigate } from '../utils';
import type { RewardMode } from '../types';

type SocialKey = 'website' | 'x' | 'telegram' | 'discord';
const SOCIAL_FIELDS: { key: SocialKey; label: string; placeholder: string }[] = [
  { key: 'website', label: 'Website', placeholder: 'https://your-site.com' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/yourcoin' },
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/yourcoin' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/yourcoin' },
];

function validSocial(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function CreateCoinPage() {
  const { state, act, busy, toast } = useApp();
  const eligible = useMemo(
    () => state.pokemon.filter((p) => !p.listed && !p.locked),
    [state.pokemon],
  );
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState(
    eligible.find((p) => p.id === state.profile.equippedId)?.id || eligible[0]?.id || '',
  );
  const [mode, setMode] = useState<RewardMode>('Mixed');
  const [coinImage, setCoinImage] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [socials, setSocials] = useState<Record<SocialKey, string>>({
    website: '',
    x: '',
    telegram: '',
    discord: '',
  });
  const [pokemonFilter, setPokemonFilter] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const imageRequest = useRef(0);

  useEffect(() => {
    if (!eligible.some((p) => p.id === selectedId)) setSelectedId(eligible[0]?.id || '');
  }, [eligible, selectedId]);
  useEffect(
    () => () => {
      imageRequest.current += 1;
    },
    [],
  );

  const selected = eligible.find((p) => p.id === selectedId);
  const trainerLaunch = state.pokemon.length === 0;
  const selectedSpecies = selected ? pokemonById(selected.speciesId) : null;
  const duplicateTicker = state.coins.some(
    (coin) => coin.ticker.toUpperCase() === ticker.trim().toUpperCase(),
  );
  const invalidSocial = SOCIAL_FIELDS.some(({ key }) => !validSocial(socials[key]));
  const canCreate =
    name.trim().length >= 3 &&
    name.trim().length <= 32 &&
    /^[A-Z0-9]{2,10}$/.test(ticker) &&
    !duplicateTicker &&
    !invalidSocial &&
    (trainerLaunch || !!selected) &&
    !imageLoading;
  const shownPokemon = eligible.filter((p) =>
    pokemonById(p.speciesId).name.toLowerCase().includes(pokemonFilter.trim().toLowerCase()),
  );

  const readImage = async (file?: File) => {
    if (!file) return;
    setImageError('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageError('Choose a PNG, JPG, WebP, or GIF image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError('Choose an image smaller than 2 MB.');
      return;
    }
    const request = ++imageRequest.current;
    setImageLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('This image could not be read.'));
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          if (!image.naturalWidth || !image.naturalHeight) {
            reject(new Error('This image is empty.'));
          } else if (image.naturalWidth > 4096 || image.naturalHeight > 4096) {
            reject(new Error('Use an image no larger than 4096 × 4096 pixels.'));
          } else resolve();
        };
        image.onerror = () => reject(new Error('This image could not be opened.'));
        image.src = dataUrl;
      });
      if (request === imageRequest.current) setCoinImage(dataUrl);
    } catch (error) {
      if (request === imageRequest.current) {
        setImageError(error instanceof Error ? error.message : 'Please choose another image.');
      }
    } finally {
      if (request === imageRequest.current) setImageLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || busy) return;
    const next = await act({
      type: 'coin.create',
      name: name.trim(),
      ticker,
      description: description.trim(),
      mode,
      ...(selected ? { pokemonInstanceId: selected.id } : {}),
      ...(coinImage ? { image: coinImage } : {}),
      socials: Object.fromEntries(
        Object.entries(socials)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value),
      ),
    });
    if (next) {
      toast('Coin draft saved. No token or transaction was created.');
      navigate('/coin/' + next.createdCoins[next.createdCoins.length - 1]);
    }
  };

  return (
    <div className="creation-desk">
      <div className="creation-heading">
        <div>
          <h1>Create coin</h1>
          <p>Set up your coin, choose its Pokémon, and decide how holders earn rewards.</p>
        </div>
        <span className="creation-draft-stamp">DRAFT</span>
      </div>

      <div className="creation-layout">
        <form className="creation-form" onSubmit={submit}>
          <section className="creation-section creation-identity">
            <div className="creation-section-label">
              <h2>Coin details</h2>
              <span>Visible on your coin page</span>
            </div>
            <div className="creation-identity-fields">
              <div className="coin-image-field">
                <label className="creation-label" htmlFor="coin-image">
                  Coin image
                </label>
                <input
                  ref={fileInput}
                  id="coin-image"
                  tabIndex={-1}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="creation-file-input"
                  onChange={(event) => readImage(event.target.files?.[0])}
                  aria-describedby="coin-image-help"
                />
                <button
                  className={'coin-image-upload ' + (coinImage ? 'has-image' : '')}
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={imageLoading}
                  aria-label={coinImage ? 'Change coin image' : 'Upload coin image'}
                >
                  {coinImage ? (
                    <img src={coinImage} alt="Your coin image" />
                  ) : (
                    <>
                      <span className="pixel-upload-mark" aria-hidden="true" />
                      <strong>{imageLoading ? 'Loading…' : 'Upload image'}</strong>
                    </>
                  )}
                  {coinImage && <span className="image-change-label">CHANGE</span>}
                </button>
                <span id="coin-image-help" className="creation-field-note">
                  Square image · up to 2 MB
                </span>
                {coinImage && (
                  <button
                    className="creation-text-button"
                    type="button"
                    onClick={() => setCoinImage('')}
                  >
                    Remove image
                  </button>
                )}
              </div>
              <div className="coin-name-fields">
                <label className="creation-label" htmlFor="coin-name">
                  Name
                </label>
                <input
                  id="coin-name"
                  className="creation-input"
                  value={name}
                  maxLength={32}
                  minLength={3}
                  required
                  placeholder="Your coin name"
                  onChange={(event) => setName(event.target.value)}
                />
                <label className="creation-label" htmlFor="coin-ticker">
                  Ticker
                </label>
                <div className="creation-ticker-field">
                  <span aria-hidden="true">$</span>
                  <input
                    id="coin-ticker"
                    value={ticker}
                    maxLength={10}
                    required
                    placeholder="TICKER"
                    pattern="[A-Z0-9]{2,10}"
                    onChange={(event) =>
                      setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                    }
                    aria-invalid={duplicateTicker}
                    aria-describedby={duplicateTicker ? 'ticker-error' : undefined}
                  />
                </div>
                {duplicateTicker && (
                  <p id="ticker-error" className="creation-error">
                    That ticker is already in use.
                  </p>
                )}
              </div>
            </div>
            {imageError && (
              <p className="creation-error" role="alert">
                {imageError}
              </p>
            )}
            <label className="creation-label" htmlFor="coin-description">
              Description
            </label>
            <textarea
              id="coin-description"
              className="creation-input"
              rows={3}
              maxLength={280}
              placeholder="Tell holders what your coin is about."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="creation-field-footer">
              <span>Your coin image and launch Pokémon are separate.</span>
              <span>{description.length}/280</span>
            </div>
          </section>

          <section className="creation-section">
            <div className="creation-section-label">
              <h2>Launch Pokémon</h2>
              <span>{trainerLaunch ? 'Trainer launch' : eligible.length + ' available'}</span>
            </div>
            {trainerLaunch ? (
              <div className="trainer-launch-panel">
                <Avatar profile={state.profile} size={72} />
                <div>
                  <strong>{profileName(state)}</strong>
                  <p>Your inventory is empty, so this coin will launch as your trainer.</p>
                </div>
              </div>
            ) : eligible.length === 0 ? (
              <div className="creation-unavailable">
                <strong>No Pokémon available</strong>
                <p>
                  Your Pokémon are listed or locked. Unlist one or finish its battle to use it for
                  this coin.
                </p>
                <a href="#/pokemon">Open inventory →</a>
              </div>
            ) : (
              <>
                <p className="creation-section-note">
                  Choose a Pokémon from your inventory. You keep ownership.
                </p>
                {eligible.length > 8 && (
                  <input
                    aria-label="Find a launch Pokémon"
                    className="creation-input pokemon-selector-search"
                    placeholder="Find a Pokémon…"
                    value={pokemonFilter}
                    onChange={(event) => setPokemonFilter(event.target.value)}
                  />
                )}
                <div
                  className="owned-pokemon-selector"
                  role="group"
                  aria-label="Choose launch Pokémon"
                >
                  {shownPokemon.map((pokemon) => {
                    const species = pokemonById(pokemon.speciesId);
                    return (
                      <button
                        className={selectedId === pokemon.id ? 'chosen' : ''}
                        key={pokemon.id}
                        type="button"
                        onClick={() => setSelectedId(pokemon.id)}
                        aria-pressed={selectedId === pokemon.id}
                      >
                        <span className="launch-selection-cursor" aria-hidden="true">
                          {selectedId === pokemon.id ? '▶' : ''}
                        </span>
                        <PokemonArt id={pokemon.speciesId} />
                        <strong>{species.name}</strong>
                        <small>Lv. {pokemon.level}</small>
                      </button>
                    );
                  })}
                </div>
                {!shownPokemon.length && (
                  <p className="creation-empty-search">No matching Pokémon in your inventory.</p>
                )}
              </>
            )}
          </section>

          <section className="creation-section">
            <div className="creation-section-label">
              <h2>Holder rewards</h2>
              <span>Choose one mode</span>
            </div>
            <div className="creation-reward-options" role="radiogroup" aria-label="Reward mode">
              {(['Eggs', 'Packs', 'Mixed'] as RewardMode[]).map((rewardMode) => (
                <button
                  type="button"
                  key={rewardMode}
                  className={mode === rewardMode ? 'selected' : ''}
                  role="radio"
                  aria-checked={mode === rewardMode}
                  onClick={() => setMode(rewardMode)}
                >
                  <span className="creation-mode-art">
                    {rewardMode === 'Packs' ? (
                      <PackArt />
                    ) : (
                      <EggArt tier={rewardMode === 'Mixed' ? 'Rare' : 'Standard'} />
                    )}
                  </span>
                  <span>
                    <strong>{rewardMode}</strong>
                    <small>
                      {rewardMode === 'Eggs'
                        ? 'Timed hatching. Better chances of rare Pokémon.'
                        : rewardMode === 'Packs'
                          ? 'Open immediately. Lower chances of rare Pokémon.'
                          : 'Holders receive both eggs and packs.'}
                    </small>
                  </span>
                  <span className="creation-radio" aria-hidden="true">
                    {mode === rewardMode ? '●' : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="creation-fee-split">
              <span>
                <strong>50%</strong> Creator
              </span>
              <span>
                <strong>50%</strong> Holder rewards
              </span>
            </div>
            <p className="creation-section-note">
              Rewards are funded from collected creator fees. They pause when the reward pool needs
              more funds.
            </p>
          </section>

          <details className="creation-section creation-socials" open={invalidSocial || undefined}>
            <summary>
              <h2>Social links</h2>
              <span>
                Optional <b aria-hidden="true">+</b>
              </span>
            </summary>
            <div className="creation-social-fields">
              {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="creation-label" htmlFor={'coin-social-' + key}>
                    {label}
                  </label>
                  <input
                    id={'coin-social-' + key}
                    className="creation-input"
                    type="url"
                    placeholder={placeholder}
                    value={socials[key]}
                    maxLength={300}
                    onChange={(event) => setSocials({ ...socials, [key]: event.target.value })}
                    aria-invalid={!validSocial(socials[key])}
                    aria-describedby={
                      !validSocial(socials[key]) ? 'social-error-' + key : undefined
                    }
                  />
                  {!validSocial(socials[key]) && (
                    <p id={'social-error-' + key} className="creation-error">
                      Enter a full http:// or https:// link.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>

          <div className="creation-submit">
            <p>Frontend preview. This saves a draft; it does not deploy a token.</p>
            <Button type="submit" disabled={!canCreate || busy}>
              {busy ? 'Saving…' : 'Create coin draft'}
            </Button>
          </div>
        </form>

        <aside className="creation-preview" aria-label="Live coin preview">
          <div className="creation-preview-header">
            <strong>COIN PREVIEW</strong>
            <span>● ● ●</span>
          </div>
          <div className="creation-preview-scene">
            <div className="creation-scene-cloud cloud-left" />
            <div className="creation-scene-cloud cloud-right" />
            <div className="creation-scene-ground" />
            <div className="creation-scene-path" />
            <div className="creation-scene-grass grass-a" />
            <div className="creation-scene-grass grass-b" />
            <div className="creation-scene-partner">
              {selected ? (
                <PokemonArt id={selected.speciesId} eager />
              ) : (
                <Avatar profile={state.profile} size={115} />
              )}
            </div>
            <div className="creation-scene-name">
              {selectedSpecies?.name || profileName(state)}
              {selected && <small>Lv. {selected.level}</small>}
            </div>
          </div>
          <div className="creation-preview-identity">
            <div className="creation-preview-image">
              {coinImage ? (
                <img src={coinImage} alt="Coin preview" />
              ) : (
                <span>
                  YOUR
                  <br />
                  IMAGE
                </span>
              )}
            </div>
            <div>
              <h2>{name.trim() || 'Coin name'}</h2>
              <span>{'$' + (ticker || 'TICKER')}</span>
            </div>
          </div>
          <p className="creation-preview-description">
            {description.trim() || 'Your description will appear here.'}
          </p>
          <div className="creation-preview-data">
            <div>
              <span>Launched with</span>
              <strong>{selectedSpecies?.name || 'Trainer'}</strong>
            </div>
            <div>
              <span>Holder rewards</span>
              <strong>{mode}</strong>
            </div>
            <div>
              <span>Reward pool</span>
              <strong>0 SOL</strong>
            </div>
          </div>
          {selectedSpecies && (
            <div className="creation-preview-types">
              {selectedSpecies.types.map((type) => (
                <TypeChip key={type} type={type} />
              ))}
            </div>
          )}
          <div className="creation-preview-links">
            {SOCIAL_FIELDS.filter(({ key }) => socials[key].trim()).map(({ key, label }) =>
              validSocial(socials[key]) ? (
                <a key={key} href={socials[key].trim()} target="_blank" rel="noopener noreferrer">
                  {label} ↗
                </a>
              ) : (
                <span key={key}>{label}</span>
              ),
            )}
          </div>
          <div className="creation-preview-footer">
            Your gym badge will use <strong>{ticker || 'TICKER'}</strong>.
          </div>
        </aside>
      </div>
    </div>
  );
}
