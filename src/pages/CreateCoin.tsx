import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Avatar, Button, EggArt, Icon, PackArt, PokemonArt, TypeChip } from '../components/UI';
import { pokemonById } from '../data/pokemon';
import { useApp } from '../state/AppContext';
import { isValidCoinTicker, profileName } from '../state/model';
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
  const [step, setStep] = useState(0);
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
  const stepTitle = useRef<HTMLHeadingElement>(null);
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
  const invalidSocial = SOCIAL_FIELDS.some(({ key }) => !validSocial(socials[key]));
  const canCreate =
    name.trim().length >= 3 &&
    name.trim().length <= 32 &&
    isValidCoinTicker(ticker) &&
    !invalidSocial &&
    (trainerLaunch || !!selected) &&
    !imageLoading &&
    !imageError;
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
    if (step < 4) {
      if (stepValid[step]) setStep(step + 1);
      return;
    }
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

  const steps = ['Details', 'Pokémon', 'Rewards', 'Links', 'Review'];
  const stepValid = [
    name.trim().length >= 3 && isValidCoinTicker(ticker) && !imageLoading && !imageError,
    trainerLaunch || !!selected,
    true,
    !invalidSocial,
    canCreate,
  ];
  useEffect(() => {
    stepTitle.current?.focus();
  }, [step]);
  const nextLabels = ['Next: Pokémon', 'Next: Rewards', 'Next: Links', 'Review coin'];
  const partnerArt = selected ? (
    <PokemonArt id={selected.speciesId} shiny={selected.shiny} eager />
  ) : (
    <Avatar profile={state.profile} size={144} />
  );

  return (
    <div className="creation-desk">
      <header className="creation-heading">
        <div>
          <h1>Create a coin</h1>
          <p>Your community starts here. Make it yours, one step at a time.</p>
        </div>
      </header>
      <nav className="wizard-progress" aria-label="Launch steps">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={step === index ? 'step' : undefined}
            className={step === index ? 'current' : step > index ? 'complete' : ''}
            disabled={index > step}
            onClick={() => setStep(index)}
          >
            <span>{index < step ? <Icon name="Check" size={16} /> : index + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </nav>
      <div className="creation-layout">
        <form className="creation-form" onSubmit={submit} noValidate>
          <section
            className="creation-section wizard-step"
            key={step}
            aria-labelledby="wizard-step-title"
          >
            <div className="creation-section-label">
              <div>
                <span className="wizard-step-kicker">
                  Step {step + 1} of {steps.length}
                </span>
                <h2 id="wizard-step-title" ref={stepTitle} tabIndex={-1}>
                  {
                    [
                      'Give it an identity',
                      'Choose your launch Pokémon',
                      'Choose holder rewards',
                      'Connect your community',
                      'Ready for your first holders?',
                    ][step]
                  }
                </h2>
              </div>
            </div>
            {step === 0 && (
              <>
                <div className="creation-identity-fields">
                  <div className="coin-image-field">
                    <label className="creation-label" htmlFor="coin-image">
                      Coin image <small>optional</small>
                    </label>
                    <input
                      ref={fileInput}
                      id="coin-image"
                      tabIndex={-1}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="creation-file-input"
                      onChange={(e) => readImage(e.target.files?.[0])}
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
                          <Icon name="Plus" size={28} />
                          <strong>{imageLoading ? 'Loading…' : 'Upload image'}</strong>
                        </>
                      )}
                      {coinImage && <span className="image-change-label">Change image</span>}
                    </button>
                    <span id="coin-image-help" className="creation-field-note">
                      PNG, JPG, WebP or GIF · up to 2 MB
                    </span>
                    {coinImage && (
                      <button
                        className="creation-text-button"
                        type="button"
                        onClick={() => {
                          setCoinImage('');
                          setImageError('');
                        }}
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  <div className="coin-name-fields">
                    <label className="creation-label" htmlFor="coin-name">
                      Coin name
                    </label>
                    <input
                      id="coin-name"
                      className="creation-input"
                      value={name}
                      maxLength={32}
                      minLength={3}
                      required
                      placeholder="e.g. Moonstone Club"
                      onChange={(e) => setName(e.target.value)}
                    />
                    <span className="creation-field-note">3–32 characters</span>
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
                        placeholder="e.g. moon club"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(e) => setTicker(e.target.value)}
                        aria-invalid={ticker.length > 0 && !isValidCoinTicker(ticker)}
                        aria-describedby="ticker-help"
                      />
                    </div>
                    <span id="ticker-help" className="creation-field-note">
                      1–10 characters · case and spaces are kept
                    </span>
                  </div>
                </div>
                {imageError && (
                  <p className="creation-error" role="alert">
                    {imageError}{' '}
                    <button
                      type="button"
                      className="creation-text-button"
                      onClick={() => {
                        setCoinImage('');
                        setImageError('');
                      }}
                    >
                      Continue without an image
                    </button>
                  </p>
                )}
                <label className="creation-label" htmlFor="coin-description">
                  Description <small>optional</small>
                </label>
                <textarea
                  id="coin-description"
                  className="creation-input"
                  rows={3}
                  maxLength={280}
                  placeholder="What brings your community together?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="creation-field-footer">
                  <span>Your coin image is separate from your Pokémon.</span>
                  <span>{description.length}/280</span>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                {trainerLaunch ? (
                  <div className="trainer-launch-panel">
                    <Avatar profile={state.profile} size={112} />
                    <div>
                      <strong>{profileName(state)}</strong>
                      <p>Your inventory is empty, so this coin will launch as your trainer.</p>
                      <span className="creation-field-note">
                        Collect a Pokémon any time to start building your team.
                      </span>
                    </div>
                  </div>
                ) : eligible.length === 0 ? (
                  <div className="creation-unavailable">
                    <strong>No Pokémon available</strong>
                    <p>
                      Your Pokémon are listed or locked. Unlist one or finish its battle to use it
                      for this coin.
                    </p>
                    <a href="#/pokemon">Open inventory →</a>
                  </div>
                ) : (
                  <>
                    <p className="creation-section-note">
                      Choose one of your Pokémon to represent the coin. It stays in your inventory.
                    </p>
                    {eligible.length > 8 && (
                      <input
                        aria-label="Find a launch Pokémon"
                        className="creation-input pokemon-selector-search"
                        placeholder="Find a Pokémon…"
                        value={pokemonFilter}
                        onChange={(e) => setPokemonFilter(e.target.value)}
                      />
                    )}
                    <div
                      className="owned-pokemon-selector"
                      role="group"
                      aria-label="Choose launch Pokémon"
                    >
                      {shownPokemon.map((pokemon) => (
                        <button
                          className={selectedId === pokemon.id ? 'chosen' : ''}
                          key={pokemon.id}
                          type="button"
                          onClick={() => setSelectedId(pokemon.id)}
                          aria-pressed={selectedId === pokemon.id}
                        >
                          {selectedId === pokemon.id && (
                            <span className="launch-selection-cursor">
                              <Icon name="Check" size={14} />
                            </span>
                          )}
                          <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} />
                          <strong>{pokemonById(pokemon.speciesId).name}</strong>
                          <small>Lv. {pokemon.level}</small>
                        </button>
                      ))}
                    </div>
                    {!shownPokemon.length && (
                      <p className="creation-empty-search">
                        No matching Pokémon in your inventory.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <p className="creation-section-note">
                  Every mode can reveal different Pokémon. Choose the pace your holders will enjoy.
                </p>
                <div className="creation-reward-options" role="group" aria-label="Reward mode">
                  {(['Eggs', 'Packs', 'Mixed'] as RewardMode[]).map((rewardMode) => (
                    <button
                      type="button"
                      key={rewardMode}
                      className={mode === rewardMode ? 'selected' : ''}
                      aria-pressed={mode === rewardMode}
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
                        <strong>{rewardMode === 'Mixed' ? 'Eggs + packs' : rewardMode}</strong>
                        <small>
                          {rewardMode === 'Eggs'
                            ? 'Hatch over time. Walk to speed things up. Better odds of rare discoveries.'
                            : rewardMode === 'Packs'
                              ? 'Open instantly. A quick reveal with a chance of something special.'
                              : 'A little of both: instant pack reveals and eggs worth waiting for.'}
                        </small>
                      </span>
                      <span className="creation-radio" aria-hidden="true">
                        {mode === rewardMode && <Icon name="Check" size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="creation-fee-split">
                  <span>
                    <strong>50%</strong>Creator
                  </span>
                  <span>
                    <strong>50%</strong>Holder rewards
                  </span>
                </div>
                <p className="creation-section-note">
                  Collected creator fees fund every reward and evolution. Rewards wait when the pool
                  needs more funds.
                </p>
              </>
            )}
            {step === 3 && (
              <>
                <p className="creation-section-note">
                  Help holders find you. All links are optional — you can continue without them.
                </p>
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
                        onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
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
              </>
            )}
            {step === 4 && (
              <>
                <div className="wizard-review-identity">
                  <div className="wizard-review-image">
                    {coinImage ? <img src={coinImage} alt="Coin preview" /> : partnerArt}
                  </div>
                  <div>
                    <h3>{name}</h3>
                    <strong>${ticker}</strong>
                    <p>{description || 'No description added.'}</p>
                  </div>
                  <button type="button" onClick={() => setStep(0)}>
                    Edit
                  </button>
                </div>
                <dl className="wizard-review-list">
                  <div>
                    <dt>Launched with</dt>
                    <dd>
                      {selectedSpecies?.name || profileName(state)}
                      <button type="button" onClick={() => setStep(1)}>
                        Edit
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Holder rewards</dt>
                    <dd>
                      {mode === 'Mixed' ? 'Eggs + packs' : mode}
                      <button type="button" onClick={() => setStep(2)}>
                        Edit
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Creator fees</dt>
                    <dd>50% creator · 50% rewards</dd>
                  </div>
                  <div>
                    <dt>Community links</dt>
                    <dd>
                      {SOCIAL_FIELDS.filter(({ key }) => socials[key].trim())
                        .map(({ label }) => label)
                        .join(', ') || 'None added'}
                      <button type="button" onClick={() => setStep(3)}>
                        Edit
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Gym badge</dt>
                    <dd>${ticker}</dd>
                  </div>
                </dl>
                <div className="wizard-launch-note">
                  <Icon name="Info" size={20} />
                  <span>
                    <strong>Save your coin draft</strong>This version saves your setup on this
                    browser. A token launch and wallet confirmation will be available when the
                    backend is connected.
                  </span>
                </div>
              </>
            )}
          </section>
          <footer className="wizard-footer">
            {step > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(step - 1)}
                disabled={busy}
              >
                <Icon name="ArrowLeft" size={16} />
                Back
              </Button>
            ) : (
              <a href="#/discover" className="wizard-cancel">
                Cancel
              </a>
            )}
            <span>
              {step + 1} / {steps.length}
            </span>
            <Button type="submit" disabled={!stepValid[step] || busy}>
              {busy ? 'Saving…' : step < 4 ? nextLabels[step] : 'Create coin draft'}
              <Icon name={step === 4 ? 'Check' : 'ArrowRight'} size={16} />
            </Button>
          </footer>
        </form>
        <aside className="creation-preview" aria-label="Live coin preview">
          <div className="creation-preview-header">
            <strong>Your coin</strong>
            <span>Live preview</span>
          </div>
          <div className="creation-preview-stage">{partnerArt}</div>
          <div className="creation-preview-identity">
            <div className="creation-preview-image">
              {coinImage ? (
                <img src={coinImage} alt="Coin image preview" />
              ) : (
                <Icon name="Plus" size={24} />
              )}
            </div>
            <div>
              <h2>{name.trim() || 'Coin name'}</h2>
              <span>${ticker || 'TICKER'}</span>
            </div>
          </div>
          <p className="creation-preview-description">
            {description.trim() || 'A new community, ready to grow.'}
          </p>
          {selectedSpecies && (
            <div className="creation-preview-types">
              {selectedSpecies.types.map((type) => (
                <TypeChip key={type} type={type} />
              ))}
            </div>
          )}
          <div className="creation-preview-footer">
            <span>Holder rewards</span>
            <strong>{mode === 'Mixed' ? 'Eggs + packs' : mode}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
