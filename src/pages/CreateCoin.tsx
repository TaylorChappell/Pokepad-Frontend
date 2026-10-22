import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Avatar, Button, EggArt, Icon, PackArt, PokemonArt, TypeChip } from '../components/UI';
import { pokemonById } from '../data/pokemon';
import { useApp } from '../state/AppContext';
import { isValidCoinTicker, profileName } from '../state/model';
import { asset, navigate } from '../utils';
import { CoinImagePicker } from '../components/CoinImagePicker';
import type { RewardMode } from '../types';
import { apiRequest } from '../services/http';
import { useTransactionFlow, type TransactionConfirmation } from '../services/transactions';
import { TransactionStatus } from '../components/TransactionStatus';
import { WalletConnection } from '../components/WalletConnection';

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
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function CreateCoinPage() {
  const { state, act, busy: actionBusy, toast, mode: appMode, session, reload } = useApp();
  const transaction = useTransactionFlow(state.profile.wallet, 'launch', finishLaunch);
  const [uploading, setUploading] = useState(false);
  const upload = useRef<{ body: string; requestId: string; assetId?: string } | null>(null);
  const uploadingNow = useRef(false);
  const busy = actionBusy || transaction.busy || uploading;
  const isLive = appMode === 'live';
  const eligible = useMemo(() => state.pokemon.filter((p) => !p.locked), [state.pokemon]);
  const [step, setStep] = useState(0);
  const [launchKind, setLaunchKind] = useState<'pokemon' | 'trainer'>(
    eligible.length ? 'pokemon' : 'trainer',
  );
  const [pokemonPage, setPokemonPage] = useState(0);
  const [smallScreen, setSmallScreen] = useState(() => window.innerWidth < 640);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState(
    eligible.find((p) => p.id === state.profile.equippedId)?.id || eligible[0]?.id || '',
  );
  const [mode, setMode] = useState<RewardMode>('Mixed');
  const [coinImage, setCoinImage] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [socials, setSocials] = useState<Record<SocialKey, string>>({
    website: '',
    x: '',
    telegram: '',
    discord: '',
  });
  const [pokemonFilter, setPokemonFilter] = useState('');
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const firstSocialInput = useRef<HTMLInputElement>(null);
  const focusLinksOnReturn = useRef(false);

  useEffect(() => {
    if (!eligible.some((p) => p.id === selectedId)) setSelectedId(eligible[0]?.id || '');
  }, [eligible, selectedId]);
  useEffect(() => {
    const resize = () => setSmallScreen(window.innerWidth < 640);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const trainerLaunch = launchKind === 'trainer';
  const selected = trainerLaunch ? undefined : eligible.find((p) => p.id === selectedId);
  const selectedSpecies = selected ? pokemonById(selected.speciesId) : null;
  const invalidSocial = SOCIAL_FIELDS.some(({ key }) => !validSocial(socials[key]));
  const nameValid =
    name.trim().length >= 3 &&
    (isLive ? new TextEncoder().encode(name.trim()).length <= 32 : name.trim().length <= 32);
  const tickerValid = isLive
    ? ticker.trim().length > 0 &&
      new TextEncoder().encode(ticker).length <= 13 &&
      !/[\u0000-\u001f\u007f]/.test(ticker)
    : isValidCoinTicker(ticker);
  const detailsValid =
    nameValid && tickerValid && !invalidSocial && !imageLoading && (!isLive || Boolean(coinImage));
  const canCreate = detailsValid && (trainerLaunch || !!selected);
  const shownPokemon = eligible.filter((p) =>
    pokemonById(p.speciesId).name.toLowerCase().includes(pokemonFilter.trim().toLowerCase()),
  );

  const pageSize = smallScreen ? 4 : 6;
  const pageCount = Math.max(1, Math.ceil(shownPokemon.length / pageSize));
  const safePage = Math.min(pokemonPage, pageCount - 1);
  const pagePokemon = shownPokemon.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) {
      if (stepValid[step]) setStep(step + 1);
      return;
    }
    if (!canCreate || busy || transaction.pending || uploadingNow.current) return;
    if (isLive) {
      if (session.status !== 'authenticated') {
        toast('Connect your Solana wallet before launching.');
        return;
      }
      let asset: { assetId: string };
      const metadata = {
        imageDataUrl: coinImage,
        name: name.trim(),
        symbol: ticker,
        description: description.trim(),
        socials: Object.fromEntries(
          Object.entries(socials)
            .map(([key, value]) => [key, value.trim()])
            .filter(([, value]) => value),
        ),
      };
      const body = JSON.stringify(metadata);
      if (upload.current?.body !== body) upload.current = { body, requestId: crypto.randomUUID() };
      uploadingNow.current = true;
      setUploading(true);
      try {
        asset = upload.current.assetId
          ? { assetId: upload.current.assetId }
          : await apiRequest<{ assetId: string }>('/v1/uploads/coin', {
              method: 'POST',
              json: metadata,
              headers: { 'Idempotency-Key': upload.current.requestId },
            });
        upload.current.assetId = asset.assetId;
      } catch (error) {
        toast(error instanceof Error ? error.message : 'The coin image could not be uploaded.');
        return;
      } finally {
        uploadingNow.current = false;
        setUploading(false);
      }
      const result = await transaction.execute({
        preparePath: '/v1/coins/prepare',
        confirmPath: '/v1/coins/confirm',
        body: {
          assetId: asset.assetId,
          mode,
          launchKind,
          ...(selected ? { pokemonId: selected.id } : {}),
        },
      });
      await finishLaunch(result);
      return;
    }
    const next = await act({
      type: 'coin.create',
      name: name.trim(),
      ticker,
      description: description.trim(),
      mode,
      launchKind,
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
  async function finishLaunch(result: TransactionConfirmation | null) {
    if (result?.status !== 'confirmed') return;
    await reload();
    toast('Your coin launch is confirmed.');
    if (result.coinId) navigate('/coin/' + result.coinId);
  }

  const steps = ['Details', 'Partner', 'Rewards', 'Review'];
  const stepValid = [detailsValid, trainerLaunch || !!selected, true, canCreate];
  useEffect(() => {
    if (step === 0 && focusLinksOnReturn.current) {
      firstSocialInput.current?.focus();
      focusLinksOnReturn.current = false;
    } else {
      stepTitle.current?.focus();
    }
  }, [step]);
  const nextLabels = ['Next: Partner', 'Next: Rewards', 'Review coin'];
  const partnerArt = selected ? (
    <PokemonArt id={selected.speciesId} shiny={selected.shiny} eager />
  ) : (
    <Avatar profile={state.profile} size={144} />
  );

  return (
    <div className="creation-desk creation-v7 creation-refined">
      <header className="creation-heading">
        <div>
          <h1>Create a coin</h1>
          <p>A coin, a partner, and a community of your own.</p>
        </div>
      </header>
      {isLive && (transaction.pending || transaction.error) && step !== 3 && (
        <TransactionStatus {...transaction} />
      )}
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
            <span>
              {index < step ? (
                <Icon name="Check" size={16} />
              ) : index === step ? (
                <Icon name="Pokeball" size={20} />
              ) : (
                index + 1
              )}
            </span>
            <strong>{label}</strong>
          </button>
        ))}
      </nav>
      <div className="creation-layout">
        <form className="creation-form" onSubmit={submit} noValidate>
          <section
            className={'creation-section wizard-step wizard-step-' + step}
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
                      'Choose your launch partner',
                      'Choose holder rewards',
                      'Ready for your first holders?',
                    ][step]
                  }
                </h2>
              </div>
              <div className="creation-device-lights" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            {step === 0 && (
              <>
                <div className="creation-details-content">
                  <div className="creation-identity-fields">
                    <CoinImagePicker
                      value={coinImage}
                      onChange={setCoinImage}
                      onBusyChange={setImageLoading}
                      live={isLive}
                      disabled={busy}
                    />
                    <div className="coin-name-fields">
                      <div>
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
                          aria-invalid={Boolean(name) && !nameValid}
                        />
                        <span className="creation-field-note">
                          {name && !nameValid
                            ? 'Use a name between 3 and 32 characters.'
                            : '3–32 characters'}
                        </span>
                      </div>
                      <div>
                        <label className="creation-label" htmlFor="coin-ticker">
                          Ticker
                        </label>
                        <div className="creation-ticker-field">
                          <span aria-hidden="true">$</span>
                          <input
                            id="coin-ticker"
                            value={ticker}
                            maxLength={isLive ? 13 : 10}
                            required
                            placeholder="e.g. moon club"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            onChange={(e) => setTicker(e.target.value)}
                            aria-invalid={
                              ticker.length > 0 &&
                              (isLive
                                ? new TextEncoder().encode(ticker).length > 13 || !ticker.trim()
                                : !isValidCoinTicker(ticker))
                            }
                            aria-describedby="ticker-help"
                          />
                        </div>
                        <span id="ticker-help" className="creation-field-note">
                          {ticker && !tickerValid
                            ? 'Choose a shorter, non-empty ticker.'
                            : `Up to ${isLive ? 13 : 10} characters`}
                        </span>
                      </div>
                      <div className="coin-description-field">
                        <label className="creation-label" htmlFor="coin-description">
                          Description <small>optional</small>
                        </label>
                        <textarea
                          id="coin-description"
                          className="creation-input"
                          rows={2}
                          maxLength={280}
                          placeholder="What brings your community together?"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                        <div className="creation-field-footer">
                          <span>{description.length}/280</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <section className="creation-socials" aria-labelledby="creation-socials-title">
                  <h3 id="creation-socials-title">
                    <Icon name="Link" size={16} />
                    Social links <small>optional</small>
                  </h3>
                  <div id="creation-social-links" className="creation-links-panel">
                    <div className="creation-social-fields">
                      {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="creation-label" htmlFor={'coin-social-' + key}>
                            {label}
                          </label>
                          <input
                            id={'coin-social-' + key}
                            ref={key === 'website' ? firstSocialInput : undefined}
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
                              Use a full https:// link.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
            {step === 1 && (
              <>
                <div className="launch-partner-source" role="group" aria-label="Launch as">
                  <button
                    type="button"
                    className={!trainerLaunch ? 'chosen' : ''}
                    aria-pressed={!trainerLaunch}
                    onClick={() => setLaunchKind('pokemon')}
                    disabled={!eligible.length}
                  >
                    <Icon name="Pokeball" size={21} />
                    <span>My Pokémon</span>
                    <small>{eligible.length} available</small>
                  </button>
                  <button
                    type="button"
                    className={trainerLaunch ? 'chosen' : ''}
                    aria-pressed={trainerLaunch}
                    onClick={() => setLaunchKind('trainer')}
                  >
                    <Avatar profile={state.profile} size={36} />
                    <span>My trainer</span>
                    <small>{profileName(state)}</small>
                  </button>
                </div>
                {trainerLaunch ? (
                  <div className="trainer-launch-panel">
                    <Avatar profile={state.profile} size={112} />
                    <div>
                      <span className="trainer-launch-caption">Launching as you</span>
                      <strong>{profileName(state)}</strong>
                      <p>
                        Your trainer will represent this coin. Your coin image and community links
                        stay separate.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="launch-selector-heading">
                      <p>Your partner stays in your inventory.</p>
                      {eligible.length > pageSize && (
                        <input
                          aria-label="Find a launch Pokémon"
                          className="creation-input pokemon-selector-search"
                          placeholder="Find a Pokémon…"
                          value={pokemonFilter}
                          onChange={(event) => {
                            setPokemonFilter(event.target.value);
                            setPokemonPage(0);
                          }}
                        />
                      )}
                    </div>
                    <div
                      className="owned-pokemon-selector"
                      role="group"
                      aria-label="Choose launch Pokémon"
                    >
                      {pagePokemon.map((pokemon) => (
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
                    {pageCount > 1 && (
                      <div className="launch-pokemon-pages" aria-label="Pokémon pages">
                        <button
                          type="button"
                          aria-label="Previous Pokémon page"
                          disabled={safePage === 0}
                          onClick={() => setPokemonPage(safePage - 1)}
                        >
                          <Icon name="ChevronLeft" size={16} />
                        </button>
                        <span>
                          {safePage + 1} / {pageCount}
                        </span>
                        <button
                          type="button"
                          aria-label="Next Pokémon page"
                          disabled={safePage >= pageCount - 1}
                          onClick={() => setPokemonPage(safePage + 1)}
                        >
                          <Icon name="ChevronRight" size={16} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <p className="creation-section-note">
                  Choose how holders discover their next Pokémon.
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
                      <span className={'creation-mode-art mode-art-' + rewardMode.toLowerCase()}>
                        {rewardMode !== 'Packs' && (
                          <EggArt tier={rewardMode === 'Mixed' ? 'Rare' : 'Standard'} />
                        )}
                        {rewardMode !== 'Eggs' && <PackArt />}
                      </span>
                      <span>
                        <strong>{rewardMode === 'Mixed' ? 'Eggs + packs' : rewardMode}</strong>
                        <small>
                          {rewardMode === 'Eggs'
                            ? 'Timed hatches. Walking helps. Better odds of rare finds.'
                            : rewardMode === 'Packs'
                              ? 'Open right away. A surprise Pokémon in every pack.'
                              : 'Both timed eggs and instant packs for your holders.'}
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
                    <strong>30%</strong>Creator
                  </span>
                  <span>
                    <strong>20%</strong>Platform
                  </span>
                  <span>
                    <strong>50%</strong>Holder rewards
                  </span>
                </div>
                <p className="creation-section-note">
                  Rewards and evolutions are issued only when collected fees can fund them.
                </p>
              </>
            )}
            {step === 3 && (
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
                  <button
                    type="button"
                    onClick={() => {
                      setStep(0);
                    }}
                  >
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
                    <dd>30% creator · 20% platform · 50% rewards</dd>
                  </div>
                  <div>
                    <dt>Community links</dt>
                    <dd>
                      {SOCIAL_FIELDS.filter(({ key }) => socials[key].trim())
                        .map(({ label }) => label)
                        .join(', ') || 'None added'}
                      <button
                        type="button"
                        onClick={() => {
                          focusLinksOnReturn.current = true;
                          setStep(0);
                        }}
                      >
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
                    <strong>{isLive ? 'Launch on Solana' : 'Save your coin draft'}</strong>
                    {isLive
                      ? 'Review the transaction in your wallet. Your coin appears after on-chain confirmation.'
                      : 'Saved on this device. No token or transaction is created in demo mode.'}
                  </span>
                </div>
                {isLive && (session.status !== 'authenticated' || !session.signingReady) && (
                  <WalletConnection />
                )}
                {isLive && !coinImage && (
                  <p role="alert">Add your coin image on the Details step before launching.</p>
                )}
                {isLive && state.features?.launching === false && (
                  <p role="status">Coin launches are currently unavailable.</p>
                )}
                {isLive && <TransactionStatus {...transaction} />}
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
            <Button
              type="submit"
              disabled={
                !stepValid[step] ||
                busy ||
                (isLive &&
                  step === 3 &&
                  (Boolean(transaction.pending) ||
                    session.status !== 'authenticated' ||
                    !session.signingReady ||
                    state.features?.launching === false))
              }
            >
              {busy
                ? isLive
                  ? 'Waiting for confirmation…'
                  : 'Saving…'
                : step < 3
                  ? nextLabels[step]
                  : isLive
                    ? transaction.pending
                      ? 'Confirming…'
                      : 'Launch coin'
                    : 'Create coin draft'}
              <Icon name={step === 3 ? 'Check' : 'ArrowRight'} size={16} />
            </Button>
          </footer>
        </form>
        <aside className="creation-preview" aria-label="Your coin preview">
          <div className="creation-preview-header">
            <strong>Your coin</strong>
          </div>
          <div className={'creation-preview-stage coin-card-art' + (coinImage ? ' has-image' : '')}>
            <img
              src={coinImage || asset('brand/kanto-emblem.png')}
              alt={coinImage ? 'Your coin artwork' : ''}
            />
          </div>
          <div className="creation-preview-identity">
            <div>
              <h2>{name.trim() || 'Coin name'}</h2>
              <span>${ticker || 'TICKER'}</span>
            </div>
          </div>
          <p className="creation-preview-description">
            {description.trim() || 'A new community, ready to grow.'}
          </p>
          <div className="creation-preview-partner">
            <span className="preview-partner-art">{partnerArt}</span>
            <div>
              <small>Launch partner</small>
              <strong>{selectedSpecies?.name || profileName(state)}</strong>
            </div>
          </div>
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
