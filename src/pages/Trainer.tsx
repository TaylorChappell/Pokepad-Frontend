import { ContentSkeleton } from '../components/Loading';
import { TrainerBanner } from '../components/TrainerImages';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, EmptyState, Icon, PokemonArt, SolValue, TypeChip } from '../components/UI';
import { GymBadge, coinForBadge } from '../components/GymBadge';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { ownTrainer, trainerDirectory, type PublicTrainer } from '../services/trainers';

export function TrainerPage({ wallet }: { wallet: string }) {
  const { state, mode, toast } = useApp();
  const own = useMemo(() => ownTrainer(state, mode === 'demo'), [state, mode]);
  const [trainer, setTrainer] = useState<PublicTrainer | null>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  let address = wallet;
  try {
    address = decodeURIComponent(wallet);
  } catch {
    /* Unknown routes show the empty state. */
  }
  useEffect(() => {
    const controller = new AbortController();
    setTrainer(undefined);
    setError('');
    trainerDirectory
      .get(address, own, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setTrainer(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error ? failure.message : 'This profile could not be loaded.',
          );
      });
    return () => controller.abort();
  }, [address, own, attempt]);
  const back = (
    <a className="button secondary trainer-back" href="#/discover">
      <Icon name="ArrowLeft" size={16} />
      Back to Discover
    </a>
  );
  if (error)
    return (
      <div className="trainer-public-page">
        {back}
        <EmptyState title="Profile unavailable" description={error}>
          <button className="button primary" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </EmptyState>
      </div>
    );
  if (trainer === undefined)
    return (
      <div className="trainer-public-page">
        {back}
        <ContentSkeleton kind="profile" label="Loading trainer profile" />
      </div>
    );
  if (trainer === null)
    return (
      <div className="trainer-public-page">
        {back}
        <EmptyState
          title="Trainer not found"
          description={
            mode === 'demo'
              ? 'This wallet is not in the sample trainer directory. Search for Leaf, Blue, or your own wallet to explore a profile.'
              : 'No registered trainer profile was found for this wallet.'
          }
        />
      </div>
    );
  const partner = trainer.pokemon.find((pokemon) => pokemon.id === trainer.partnerId);
  const gym = state.coins.find((coin) => coin.id === trainer.supportedGym);
  return (
    <div className="trainer-public-page">
      {back}
      <TrainerBanner profile={trainer} />
      <header className="trainer-public-header">
        <div className="trainer-public-identity">
          <Avatar profile={trainer} size={112} />
          <div>
            <div className="trainer-profile-label">
              Trainer profile {trainer.demo && <span>Demo profile</span>}
            </div>
            <h1>{trainer.displayName}</h1>
            <button
              className="trainer-wallet-copy"
              title={trainer.wallet}
              aria-label="Copy trainer wallet address"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(trainer.wallet);
                  toast('Wallet address copied.');
                } catch {
                  toast('Could not copy the address. Select it below to copy.');
                }
              }}
            >
              <span>{trainer.wallet}</span>
              <Icon name="Copy" size={14} />
            </button>
            {trainer.wallet === state.profile.wallet && (
              <a className="text-link" href="#/settings">
                Edit your trainer <Icon name="ArrowRight" size={14} />
              </a>
            )}
          </div>
        </div>
        {partner && (
          <div className="trainer-public-partner">
            <PokemonArt id={partner.speciesId} shiny={partner.shiny} />
            <span>
              <small>Partner Pokémon</small>
              <strong>{pokemonById(partner.speciesId).name}</strong>
              <small>Lv. {partner.level}</small>
            </span>
          </div>
        )}
      </header>
      <div className="trainer-public-stats">
        <div>
          <span>Pokémon</span>
          <strong>{trainer.pokemon.length}</strong>
        </div>
        <div>
          <span>Pokédex</span>
          <strong>
            {trainer.discovered}
            <small> / 151</small>
          </strong>
        </div>
        <div>
          <span>Collection value</span>
          <SolValue amount={trainer.pokemon.reduce((total, pokemon) => total + pokemon.value, 0)} />
        </div>
        <div>
          <span>Supported gym</span>
          <strong>{gym ? '$' + gym.ticker : 'None yet'}</strong>
        </div>
      </div>
      {trainer.badges.length > 0 && (
        <section className="trainer-public-badges">
          <h2>Gym badges</h2>
          <div>
            {trainer.badges.map((badge) => {
              const coin = coinForBadge(state.coins, badge);
              return coin ? (
                <a key={badge} href={'#/gym/' + coin.id} title={coin.name + ' gym'}>
                  <GymBadge coin={coin} size={48} />
                  <strong>{coin.ticker}</strong>
                </a>
              ) : null;
            })}
          </div>
        </section>
      )}
      <section className="trainer-public-collection">
        <div className="section-heading">
          <h2>Pokémon collection</h2>
          <span>{trainer.pokemon.length} collected</span>
        </div>
        {trainer.pokemon.length ? (
          <div className="trainer-public-grid">
            {trainer.pokemon.map((pokemon) => {
              const species = pokemonById(pokemon.speciesId);
              return (
                <article
                  className={'trainer-public-pokemon' + (pokemon.shiny ? ' has-shiny' : '')}
                  key={pokemon.id}
                >
                  <div className="trainer-public-pokemon-stage">
                    <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} />
                  </div>
                  <div className="trainer-public-pokemon-name">
                    <h3>{species.name}</h3>
                    <span>Lv. {pokemon.level}</span>
                  </div>
                  <div className="type-row">
                    {species.types.map((type) => (
                      <TypeChip key={type} type={type} />
                    ))}
                  </div>
                  <SolValue amount={pokemon.value} />
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="A new adventure"
            description="This trainer has not collected a Pokémon yet."
          />
        )}
      </section>
    </div>
  );
}
