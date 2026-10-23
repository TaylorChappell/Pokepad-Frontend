import { ListMore, useListWindow } from './ListMore';
import { ContentSkeleton } from './Loading';
import { BattleRoomReview } from './BattleRoomReview';
import {
  BattleJourney,
  BattlePresenceNotice,
  RoomNextStep,
  WaitingStake,
  battleClock,
} from './BattleRoomStatus';
import {
  rememberBattleRoom,
  savedBattleRoom,
  startBattlePresence,
} from '../services/battle-presence';
import type { BattleRules } from '../battle/rules';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { BattleTeamPicker, battleSelection, rememberBattleTeam } from './BattleTeamPicker';
import { WalletConnection } from './WalletConnection';
import { BattleFundingController, type EscrowAction } from '../services/battle-funding';
import { shortWallet } from '../state/model';
import { Button, Icon, PokemonArt, Pokeball } from './UI';
import {
  battleWagerLabel,
  proposeBattleReview,
  acceptBattleReview,
  sendBattleMessage,
  formatRawAmount,
  loadBattleCapabilities,
  monetaryTerms,
  previewBattleRoom,
  createOnlineBattle,
  currentBattleRoom,
  joinOnlineBattle,
  leaveOnlineBattle,
  listBattleRooms,
  newestBattleRoom,
  readBattleRoom,
  updateBattlePresence,
  sendBattleCommand,
  type BattleRoom,
  type BattleCapabilities,
  type MonetaryTerms,
  type OnlineWager,
  type OpenBattleRoom,
} from '../services/battles';
import type { BattleAction } from '../battle/engine';

export function useOnlineBattle(enabled: boolean) {
  const { mode, session, reload } = useApp();
  const [capabilities, setCapabilities] = useState<BattleCapabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState('');
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [rooms, setRooms] = useState<OpenBattleRoom[]>([]);
  const [error, setError] = useState('');
  const [networkError, setNetworkError] = useState('');
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [clockOffset, setClockOffset] = useState(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const pendingRef = useRef(false);
  const requestIds = useRef(new Map<string, string>());
  const generation = useRef(0);
  const restoredRoute = useRef('');
  const accept = useCallback(
    (next: BattleRoom) => {
      setRoom((current) => newestBattleRoom(current, next));
      rememberBattleRoom(session.wallet || '', next.id);
      setConnected(true);
      setClockOffset(Date.parse(next.serverTime) - Date.now());
    },
    [session.wallet],
  );
  const openRoom = !!room && ['waiting', 'review', 'funding', 'active'].includes(room.status);
  useEffect(() => {
    if (!enabled || mode !== 'live' || session.status !== 'authenticated' || !room?.id || !openRoom)
      return;
    const id = room.id;
    return startBattlePresence({
      send: (body, keepalive) => updateBattlePresence(id, body, keepalive),
      accept,
      document,
      window,
    });
  }, [enabled, mode, session.status, room?.id, openRoom, accept]);
  useEffect(() => {
    if (!enabled || mode !== 'live') return;
    const abort = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy || abort.signal.aborted || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const next = await loadBattleCapabilities(abort.signal);
        if (!abort.signal.aborted) {
          setCapabilities(next);
          setCapabilitiesError('');
        }
      } catch {
        if (!abort.signal.aborted) {
          setCapabilities(null);
          setCapabilitiesError('Wager availability could not be checked. We’ll try again shortly.');
        }
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, mode]);
  useEffect(() => {
    generation.current++;
    setRoom(null);
    setRestoring(true);
    roomRef.current = null;
    requestIds.current.clear();
    restoredRoute.current = '';
  }, [session.wallet]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!enabled || mode !== 'live' || session.status !== 'authenticated') return;
    setRestoring(true);
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (roomRef.current) {
          if (
            ['active', 'waiting', 'review', 'funding'].includes(roomRef.current.status) ||
            (roomRef.current.escrow &&
              !['settled', 'refunded'].includes(roomRef.current.escrow.status))
          ) {
            const next = await readBattleRoom(roomRef.current.id, controller.signal);
            if (!stopped) accept(next);
          }
        } else {
          const current = await currentBattleRoom(controller.signal);
          if (!stopped && current.room) accept(current.room);
          if (!current.room) {
            const routeRoom =
              new URLSearchParams(window.location.hash.split('?')[1]).get('room') ||
              savedBattleRoom(session.wallet || '');
            if (routeRoom && restoredRoute.current !== routeRoom) {
              restoredRoute.current = routeRoom;
              try {
                const previous = await readBattleRoom(routeRoom, controller.signal);
                if (!stopped) accept(previous);
              } catch {
                // An invitation belongs to an unjoined trainer; its join form remains available.
              }
            }
            const response = await listBattleRooms(controller.signal);
            if (!stopped) setRooms(response.rooms);
          }
        }
        if (!stopped) {
          setConnected(true);
          setNetworkError('');
        }
      } catch (cause) {
        if (!stopped) {
          setConnected(false);
          setNetworkError(
            cause instanceof Error ? cause.message : 'Reconnecting to the battle server…',
          );
        }
      }
      if (!stopped) {
        setRestoring(false);
        timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, mode, session.status, session.wallet, accept]);
  const mutation = async (run: () => Promise<BattleRoom>) => {
    if (pendingRef.current) return null;
    pendingRef.current = true;
    setPending(true);
    setError('');
    const epoch = generation.current;
    try {
      const next = await run();
      if (epoch !== generation.current) return null;
      const previousStatus = roomRef.current?.status;
      accept(next);
      if (
        next.status === 'waiting' ||
        next.status === 'review' ||
        (next.status === 'active' && previousStatus !== 'active')
      )
        void reload();
      return next;
    } catch (cause) {
      if (epoch === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The battle server could not complete that action.',
        );
      return null;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const keyFor = (key: string) => {
    if (!requestIds.current.has(key)) requestIds.current.set(key, crypto.randomUUID());
    return requestIds.current.get(key)!;
  };
  return {
    room,
    rooms,
    capabilities,
    capabilitiesError,
    acceptRoom: accept,
    refreshRoom: async () => {
      const current = roomRef.current;
      if (!current) return;
      try {
        accept(await readBattleRoom(current.id));
        setNetworkError('');
      } catch {
        setNetworkError('Your room could not be refreshed. We’ll keep trying.');
      }
    },
    pending,
    error: error || networkError,
    connected,
    restoring,
    clockOffset,
    create: (
      ids: string[],
      wager: OnlineWager,
      visibility: 'public' | 'invite',
      terms?: MonetaryTerms,
    ) =>
      mutation(() =>
        createOnlineBattle(
          ids,
          wager,
          visibility,
          keyFor(JSON.stringify(['create', ids, wager, visibility, terms])),
          terms,
        ),
      ),
    join: (id: string, ids: string[], wager: OnlineWager, code?: string, terms?: MonetaryTerms) =>
      mutation(() => joinOnlineBattle(id, ids, wager, code, terms)),
    propose: (
      version: number,
      changes: { pokemonIds?: string[]; rules?: BattleRules; wagerAmount?: string },
    ) => {
      const current = roomRef.current;
      return current
        ? mutation(() => proposeBattleReview(current.id, version, changes))
        : Promise.resolve(null);
    },
    ready: (version: number, accepted: boolean) => {
      const current = roomRef.current;
      return current
        ? mutation(() => acceptBattleReview(current.id, version, accepted, current.wager))
        : Promise.resolve(null);
    },
    message: (body: string) => {
      const current = roomRef.current;
      return current ? mutation(() => sendBattleMessage(current.id, body)) : Promise.resolve(null);
    },
    command: (action: BattleAction) => {
      const current = roomRef.current;
      if (!current?.state || current.submitted || current.status !== 'active')
        return Promise.resolve(null);
      const phase =
        current.state.replacementRequired?.player || current.state.replacementRequired?.rival
          ? 'replacement'
          : 'turn';
      return mutation(() =>
        sendBattleCommand(
          current.id,
          current.state!.turn,
          action,
          keyFor(JSON.stringify(['command', current.id, current.state!.turn, phase, action])),
          phase,
        ),
      );
    },
    leave: async () => {
      if (!roomRef.current) return null;
      const next = await mutation(() => leaveOnlineBattle(roomRef.current!.id));
      if (next) await reload();
      return next;
    },
    clear: () => {
      rememberBattleRoom(session.wallet || '', null);
      setRoom(null);
      roomRef.current = null;
      requestIds.current.clear();
      void reload();
    },
  };
}

export function EscrowTokenReceipt({ room }: { room: Pick<BattleRoom, 'escrow' | 'yourSeat'> }) {
  const account =
    room.escrow?.asset === 'token'
      ? room.escrow.recipientTokenAccounts?.[room.yourSeat === 0 ? 'host' : 'guest']
      : undefined;
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => setCopyStatus(''), [account]);
  if (!account) return null;
  return (
    <div className="battle-token-receipt" aria-label="Your token payout receipt">
      <strong>Your token payout account</strong>
      <div className="battle-token-receipt-address">
        <a
          href={
            'https://solscan.io/account/' +
            encodeURIComponent(account) +
            (room.escrow?.chain === 'solana:devnet' ? '?cluster=devnet' : '')
          }
          target="_blank"
          rel="noreferrer"
        >
          {account}
        </a>
        <Button
          variant="secondary"
          aria-label="Copy your token payout account"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(account);
              setCopyStatus('Token account copied.');
            } catch {
              setCopyStatus('Copy unavailable. Select and copy the account address above.');
            }
          }}
        >
          <Icon name={copyStatus === 'Token account copied.' ? 'Check' : 'Copy'} size={14} />
          Copy
        </Button>
      </div>
      <small>
        A token account owned by your wallet.{' '}
        <a
          href="https://github.com/TaylorChappell/kanto-backend/blob/main/docs/battle-escrow.md"
          target="_blank"
          rel="noreferrer"
        >
          Token recovery help
        </a>
      </small>
      <span className="battle-token-copy-status" role="status">
        {copyStatus}
      </span>
    </div>
  );
}

export function EscrowFunding({
  room,
  online,
}: {
  room: BattleRoom;
  online: ReturnType<typeof useOnlineBattle>;
}) {
  const { session, now } = useApp();
  const controller = useMemo(
    () => new BattleFundingController(session.wallet || '', room.id),
    [session.wallet, room.id],
  );
  const [funding, setFunding] = useState(controller.state);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    setFunding(controller.state);
    return controller.subscribe(setFunding);
  }, [controller]);
  const accept = (result: Awaited<ReturnType<BattleFundingController['check']>>) => {
    if (result?.room) online.acceptRoom(result.room);
    else if (result?.status === 'confirmed')
      void readBattleRoom(room.id)
        .then(online.acceptRoom)
        .catch(() => {});
    if (result?.status === 'confirmed') setConsent(false);
  };
  useEffect(() => {
    if (!funding.pending?.signingStarted && !funding.pending?.signature) return;
    void controller.check().then(accept);
    const timer = setInterval(() => {
      void controller.check().then(accept);
    }, 5000);
    return () => clearInterval(timer);
  }, [controller, funding.pending?.signingStarted, funding.pending?.signature]);
  const escrow = room.escrow;
  if (!escrow) {
    if (room.status === 'waiting' || room.status === 'review') return <WaitingStake room={room} />;
    return (
      <section className="battle-escrow-desk battle-payment-empty" role="status">
        <Icon name="Wallet" size={28} />
        <h3>
          {room.status === 'cancelled' ? 'No payment was requested' : 'Loading payment details'}
        </h3>
        <p>
          {room.status === 'cancelled'
            ? 'This room closed before the payment stage.'
            : 'Your payment button will appear when the room details arrive. There’s nothing to send manually.'}
        </p>
        {room.status !== 'cancelled' && (
          <Button variant="secondary" onClick={() => void online.refreshRoom()}>
            Refresh payment status
          </Button>
        )}
      </section>
    );
  }
  const ownDeposit = room.yourSeat === 0 ? escrow.deposits.host : escrow.deposits.guest;
  const otherDeposit = room.yourSeat === 0 ? escrow.deposits.guest : escrow.deposits.host;
  const decimals = room.wagerDecimals ?? escrow.decimals;
  const symbol = room.wagerSymbol || escrow.symbol || (room.wager === 'sol' ? 'SOL' : 'tokens');
  const amount =
    (decimals === undefined ? 'Unavailable' : formatRawAmount(escrow.amount, decimals)) +
    ' ' +
    symbol;
  const total =
    decimals !== undefined && /^\d+$/.test(escrow.amount)
      ? formatRawAmount((BigInt(escrow.amount) * 2n).toString(), decimals) + ' ' + symbol
      : null;
  const paymentExpired =
    !!escrow.depositDeadlineAt && Date.parse(escrow.depositDeadlineAt) <= now + online.clockOffset;
  const canDeposit =
    room.status === 'funding' &&
    !ownDeposit &&
    escrow.status === 'funding' &&
    escrow.initialized === true &&
    !!escrow.address &&
    !paymentExpired;
  const canRefund = escrow.status === 'refund-available' && ownDeposit;
  const action: EscrowAction = canRefund ? 'refund' : 'deposit';
  let title = 'Both stakes are secured',
    description = 'Your battle is in progress. The result decides where the stakes go.';
  if (room.status === 'funding') {
    if (paymentExpired) {
      title = 'The payment window has closed';
      description = ownDeposit
        ? 'If your rival did not pay, your refund button will appear after the payment status is confirmed.'
        : 'We’re checking the final payment status. Don’t send another payment.';
    } else if (ownDeposit && !otherDeposit) {
      title = 'You’re paid. Waiting for your rival.';
      description =
        'Keep this room open. The battle starts automatically once their payment is confirmed.';
    } else if (ownDeposit && otherDeposit) {
      title = 'Both trainers have paid';
      description = 'Getting your battle ready. You don’t need to do anything else.';
    } else if (funding.pending) {
      title = funding.pending.signature ? 'Confirming your payment' : 'Check your wallet';
      description =
        funding.message ||
        'Approve the payment in your wallet, then return here. Confirmation updates automatically.';
    } else if (!escrow.initialized) {
      title = 'Preparing your payment';
      description =
        'Your wallet button will appear automatically when the battle account is ready.';
    } else {
      title = 'Your turn to pay';
      description =
        'Press Pay with wallet below, then approve the transaction in Phantom or MetaMask. The battle starts after both payments confirm.';
    }
  }
  if (escrow.status === 'settling') {
    title = 'Sending the battle payout';
    description = 'Your result is saved. Payment updates here once it is confirmed on Solana.';
  }
  if (escrow.status === 'settled') {
    title = 'Battle payout confirmed';
    description =
      room.winnerWallet === null
        ? 'Each trainer’s stake has been returned.'
        : room.winnerWallet === session.wallet
          ? 'Both stakes have been paid to your wallet.'
          : 'Both stakes have been paid to the winning trainer.';
  }
  if (escrow.status === 'refund-available') {
    title = ownDeposit ? 'Your refund is ready' : 'This match did not start';
    description = ownDeposit
      ? 'Press Reclaim my stake to return your deposit to your wallet.'
      : 'You have no confirmed deposit to reclaim.';
  }
  if (escrow.status === 'refunded') {
    title = 'Match closed';
    description = ownDeposit
      ? 'The refund is confirmed. Your deposited stake has been returned.'
      : 'Any confirmed deposits have been returned. No further payment is needed.';
  }
  const explorerSuffix = escrow.chain === 'solana:devnet' ? '?cluster=devnet' : '';
  return (
    <section className="battle-escrow-desk" aria-label="Battle payments">
      <header className="battle-payment-heading" role="status">
        <Icon name={ownDeposit ? 'Check' : 'Wallet'} size={24} />
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      <div className="battle-payment-amounts">
        <div className="battle-escrow-amount">
          <span>Your stake</span>
          <strong>{amount}</strong>
          <small>Plus your wallet’s network fee</small>
        </div>
        {total && (
          <div>
            <span>Total prize</span>
            <strong>{total}</strong>
            <small>Both trainers’ stakes</small>
          </div>
        )}
      </div>
      <div className="battle-escrow-seats">
        <span className={ownDeposit ? 'funded' : ''}>
          <Icon name={ownDeposit ? 'Check' : 'Wallet'} size={17} /> You{' '}
          <b>
            {ownDeposit
              ? 'Payment confirmed'
              : funding.pending
                ? 'Confirming payment'
                : 'Not paid yet'}
          </b>
        </span>
        <span className={otherDeposit ? 'funded' : ''}>
          <Icon name={otherDeposit ? 'Check' : 'Clock'} size={17} /> Rival{' '}
          <b>{otherDeposit ? 'Payment confirmed' : 'Waiting for payment'}</b>
        </span>
      </div>
      {room.status === 'funding' && escrow.depositDeadlineAt && (
        <div className="battle-payment-deadline">
          <span>Both payments must confirm within</span>
          <strong>{battleClock(escrow.depositDeadlineAt, now + online.clockOffset)}</strong>
        </div>
      )}
      {(canDeposit || canRefund || funding.pending) && (
        <div className="battle-payment-action">
          {!session.signingReady &&
            !funding.pending?.signingStarted &&
            !funding.pending?.signature && <WalletConnection />}
          {!funding.pending && canDeposit && (
            <label className="online-wager-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                I’m staking <strong>{amount}</strong>. If I lose or forfeit, the winner receives my
                stake.
              </span>
            </label>
          )}
          <Button
            className="full-width"
            disabled={
              funding.busy || !!funding.pending || !session.signingReady || (canDeposit && !consent)
            }
            onClick={() => void controller.run(action).then(accept)}
          >
            <Icon name="Wallet" size={18} />
            {funding.pending
              ? 'Confirming payment…'
              : funding.busy
                ? 'Opening wallet…'
                : canRefund
                  ? 'Reclaim my stake'
                  : 'Pay with wallet · ' + amount}
          </Button>
          {!funding.pending && canDeposit && (
            <small>
              Tick the agreement above to enable payment. Your wallet will show the amount before
              you approve.
            </small>
          )}
        </div>
      )}
      {funding.message && (
        <p className="battle-payment-message" role="status">
          {funding.message}
        </p>
      )}
      {funding.error && (
        <p className="online-error" role="alert">
          {funding.error}
        </p>
      )}
      <p className="battle-payment-help">
        <Icon name="Lock" size={16} />
        <span>
          Always use the wallet button. <b>Do not transfer to the battle account manually.</b>
        </span>
      </p>
      <details className="battle-payment-details">
        <summary>
          Payment receipts &amp; details <Icon name="ChevronDown" size={14} />
        </summary>
        <p>
          The battle account holds the stakes until the match ends. These links are for checking
          payments, not making them.
        </p>
        {escrow.address && (
          <a
            href={
              'https://solscan.io/account/' + encodeURIComponent(escrow.address) + explorerSuffix
            }
            target="_blank"
            rel="noreferrer"
          >
            Inspect battle account on Solscan <Icon name="ArrowUpRight" size={13} />
          </a>
        )}
        {funding.pending?.signature && (
          <a
            href={
              'https://solscan.io/tx/' +
              encodeURIComponent(funding.pending.signature) +
              explorerSuffix
            }
            target="_blank"
            rel="noreferrer"
          >
            View my payment receipt <Icon name="ArrowUpRight" size={13} />
          </a>
        )}
        {escrow.settlementSignature && (
          <a
            href={
              'https://solscan.io/tx/' +
              encodeURIComponent(escrow.settlementSignature) +
              explorerSuffix
            }
            target="_blank"
            rel="noreferrer"
          >
            View payout receipt <Icon name="ArrowUpRight" size={13} />
          </a>
        )}
        <EscrowTokenReceipt room={room} />
      </details>
    </section>
  );
}

export function OnlineBattle({ online }: { online: ReturnType<typeof useOnlineBattle> }) {
  const { state, mode, session, now, toast } = useApp();
  const roomPage = useListWindow(
    online.rooms.filter((item) => item.hostWallet !== state.profile.wallet),
    state.profile.wallet,
    8,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [wager, setWager] = useState<OnlineWager>('friendly');
  const [amount, setAmount] = useState('0.1');
  const [tokenMint, setTokenMint] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'invite'>('public');
  const [approved, setApproved] = useState(false);
  const [desk, setDesk] = useState<'create' | 'join'>(() =>
    new URLSearchParams(window.location.hash.split('?')[1]).has('room') ? 'join' : 'create',
  );
  const [mobilePanel, setMobilePanel] = useState<'team' | 'match'>('team');
  const [joinId, setJoinId] = useState(
    () => new URLSearchParams(window.location.hash.split('?')[1]).get('room') || '',
  );
  const [invite, setInvite] = useState(
    () => new URLSearchParams(window.location.hash.split('?')[1]).get('invite') || '',
  );
  const [preview, setPreview] = useState<OpenBattleRoom | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const caps = online.capabilities;
  const eligible = mode === 'live' && session.status === 'authenticated';
  const enabled = eligible && state.features?.battles !== false;
  const activeWager = desk === 'join' ? preview?.wager || 'friendly' : wager;
  const risk = activeWager !== 'friendly';
  const ids = battleSelection(
    state.pokemon,
    selected,
    activeWager === 'pokemon',
    desk === 'join' ? preview?.teamSize || 3 : 3,
  );
  const selectedToken = caps?.tokens?.find((token) => token.mint === tokenMint);
  const monetary = activeWager === 'sol' || activeWager === 'token';
  let terms: MonetaryTerms | undefined,
    amountError = '';
  try {
    terms = monetaryTerms(wager, amount, selectedToken);
  } catch (error) {
    amountError = error instanceof Error ? error.message : 'Review your wager amount.';
  }
  const permitted =
    activeWager === 'friendly' || activeWager === 'pokemon'
      ? caps?.[activeWager] !== false
      : caps?.[activeWager] === true;
  const room = online.room;
  useEffect(() => {
    const readInvitation = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1]);
      if (params.has('room')) {
        setJoinId(params.get('room') || '');
        setInvite(params.get('invite') || '');
        setDesk('join');
        setApproved(false);
      }
    };
    window.addEventListener('hashchange', readInvitation);
    return () => window.removeEventListener('hashchange', readInvitation);
  }, []);
  useEffect(() => {
    if (!tokenMint && caps?.tokens?.length) setTokenMint(caps.tokens[0].mint);
  }, [caps, tokenMint]);
  useEffect(() => {
    setApproved(false);
  }, [
    ids.join('|'),
    wager,
    amount,
    tokenMint,
    desk,
    preview?.id,
    preview?.wager,
    preview?.wagerAmount,
    preview?.wagerMint,
  ]);
  useEffect(() => {
    setPreview(null);
    setPreviewError('');
    if (desk !== 'join' || !joinId.trim() || !eligible) {
      setLoadingPreview(false);
      return;
    }
    setLoadingPreview(true);
    const abort = new AbortController();
    const timer = setTimeout(
      () =>
        void previewBattleRoom(joinId.trim(), invite.trim() || undefined, abort.signal)
          .then((next) => {
            if (!abort.signal.aborted) setPreview(next);
          })
          .catch((error) => {
            if (!abort.signal.aborted) setPreviewError(error.message);
          })
          .finally(() => {
            if (!abort.signal.aborted) setLoadingPreview(false);
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [desk, joinId, invite, eligible]);
  const changeSelection = (next: string[]) => {
    setSelected(next);
    setApproved(false);
  };
  async function join() {
    if (!preview || preview.id !== joinId.trim()) return;
    const joinTerms =
      preview.wager === 'sol' || preview.wager === 'token'
        ? {
            wagerAmount: preview.wagerAmount!,
            ...(preview.wagerMint ? { wagerMint: preview.wagerMint } : {}),
          }
        : undefined;
    const next = await online.join(
      preview.id,
      ids,
      preview.wager,
      invite.trim() || undefined,
      joinTerms,
    );
    if (next) setApproved(false);
  }
  useEffect(() => {
    if (room && ['review', 'active', 'funding'].includes(room.status))
      rememberBattleTeam(
        state.profile.wallet,
        room.yourPokemonIds.map((id) => state.pokemon.find((p) => p.id === id)).filter((p) => !!p),
      );
  }, [room?.id, room?.status]);
  if (eligible && online.restoring && !room)
    return (
      <section className="online-room-panel">
        <header className="online-room-heading">
          <Pokeball size={36} />
          <div>
            <h2>Restoring your battle room</h2>
            <p>Checking your saved match and payment status…</p>
          </div>
        </header>
        <ContentSkeleton kind="rows" label="Loading your saved battle" />
      </section>
    );
  if (room?.status === 'review' && room.review)
    return <BattleRoomReview key={room.id} room={room} online={online} />;
  if (room) {
    const monetaryRoom = room.wager === 'sol' || room.wager === 'token';
    return (
      <section className={'online-room-panel ' + (monetaryRoom ? 'has-escrow' : '')}>
        <BattleJourney room={room} />
        <header className="online-room-heading">
          <span className="online-room-ball">
            <Pokeball size={42} />
          </span>
          <div>
            <span className="battle-desk-label">{battleWagerLabel(room)}</span>
            <h2>
              {room.status === 'waiting'
                ? 'Your battle room'
                : room.status === 'funding'
                  ? 'Secure your stakes'
                  : room.status === 'active'
                    ? 'Entering the arena…'
                    : room.status === 'cancelled'
                      ? 'Room closed'
                      : 'Battle complete'}
            </h2>
            <p>
              {room.status === 'waiting'
                ? 'Invite a rival with ' +
                  room.teamSize +
                  ' Pokémon. You will both review and accept before the battle begins.'
                : room.status === 'funding'
                  ? 'Approve your payment in your wallet. We’ll bring you into the arena when both trainers have paid.'
                  : 'Your progress is saved. Payment updates appear below.'}
            </p>
          </div>
        </header>
        <RoomNextStep room={room} clockOffset={online.clockOffset} />
        <BattlePresenceNotice room={room} clockOffset={online.clockOffset} />
        <div className="online-room-body">
          <div className="online-room-party">
            <h3>Your team is ready</h3>
            <div className="online-party-preview">
              {room.yourPokemonIds.map((id) => {
                const pokemon = state.pokemon.find((item) => item.id === id);
                return pokemon ? (
                  <div key={id}>
                    <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} animated={false} />
                    <strong>{pokemonById(pokemon.speciesId).name}</strong>
                    <small>Lv. {pokemon.level}</small>
                  </div>
                ) : (
                  <div key={id}>
                    <Icon name="Pokeball" size={36} />
                    <small>Team member</small>
                  </div>
                );
              })}
            </div>
            {room.status === 'waiting' && (
              <>
                <div className="battle-rival-seat">
                  <Pokeball size={36} />
                  <div>
                    <strong>Rival’s spot is open</strong>
                    <span>
                      {room.visibility === 'public' ? 'Listed in open rooms' : 'Invitation only'} ·{' '}
                      {room.teamSize} Pokémon each
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const url = new URL(window.location.href);
                    url.hash =
                      '/battles?room=' +
                      room.id +
                      (room.inviteCode ? '&invite=' + encodeURIComponent(room.inviteCode) : '');
                    try {
                      await navigator.clipboard.writeText(url.toString());
                      toast('Battle invitation copied');
                    } catch {
                      toast(url.toString());
                    }
                  }}
                >
                  Invite a trainer <Icon name="Copy" size={16} />
                </Button>
              </>
            )}
            {room.status === 'waiting' && (
              <Button
                variant="ghost"
                disabled={online.pending}
                onClick={async () => {
                  const next = await online.leave();
                  if (next && !monetaryRoom) online.clear();
                }}
              >
                Close room
              </Button>
            )}
            {['finished', 'cancelled'].includes(room.status) && (
              <Button onClick={online.clear}>Back to rooms</Button>
            )}
          </div>
          {monetaryRoom && <EscrowFunding room={room} online={online} />}
        </div>
        {online.error && (
          <p className="online-error" role="alert">
            {online.error}
          </p>
        )}
      </section>
    );
  }
  const rooms = online.rooms.filter((item) => item.hostWallet !== state.profile.wallet);
  const joinValid =
    preview &&
    preview.id === joinId.trim() &&
    ids.length === preview.teamSize &&
    ((preview.wager !== 'sol' && preview.wager !== 'token') ||
      Boolean(preview.wagerAmount && typeof preview.wagerDecimals === 'number'));
  return (
    <section className={'online-battle-lobby panel-' + mobilePanel}>
      <nav className="online-mobile-tabs" aria-label="Battle preparation">
        <button
          type="button"
          aria-pressed={mobilePanel === 'team'}
          onClick={() => setMobilePanel('team')}
        >
          Your party <b>{ids.length}/3</b>
        </button>
        <button
          type="button"
          aria-pressed={mobilePanel === 'match'}
          onClick={() => setMobilePanel('match')}
        >
          Match setup <Icon name="ArrowRight" size={14} />
        </button>
      </nav>
      <div className="online-team-workspace">
        <BattleTeamPicker
          pokemon={state.pokemon}
          selected={ids}
          onChange={changeSelection}
          pokemonWager={activeWager === 'pokemon'}
          teamSize={desk === 'join' ? preview?.teamSize : undefined}
          disabled={online.pending}
        />
        <button className="button primary party-next-step" onClick={() => setMobilePanel('match')}>
          Match settings <Icon name="ArrowRight" size={16} />
        </button>
      </div>
      <aside className="online-match-desk">
        <header className="online-battle-title">
          <div>
            <h2>Link battle</h2>
          </div>
          <span className="device-lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </header>
        <div className="online-desk-tabs" role="tablist" aria-label="Room action">
          <button
            type="button"
            role="tab"
            aria-selected={desk === 'create'}
            onClick={() => setDesk('create')}
          >
            Create room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={desk === 'join'}
            onClick={() => setDesk('join')}
          >
            Join room {rooms.length > 0 && <b>{rooms.length}</b>}
          </button>
        </div>
        <div className="online-desk-content">
          {!eligible && (
            <div className="online-signin-note">
              <p>
                {mode === 'demo'
                  ? 'Online rooms need a connected backend. You can try your team in Offline mode.'
                  : 'Connect your Solana wallet to join the arena.'}
              </p>
              {mode === 'live' && <WalletConnection />}
            </div>
          )}
          {eligible && state.features?.battles === false && (
            <p className="online-inline-notice">The battle service is currently unavailable.</p>
          )}
          {desk === 'create' ? (
            <>
              <label className="online-field-heading">Battle format</label>
              <div className="online-format-options" aria-label="Online battle format">
                {(['friendly', 'pokemon', 'sol', 'token'] as OnlineWager[]).map((format) => {
                  const money = format === 'sol' || format === 'token';
                  const unavailable = money && caps?.[format] !== true;
                  return (
                    <button
                      type="button"
                      key={format}
                      aria-pressed={wager === format}
                      disabled={unavailable || online.pending}
                      onClick={() => {
                        setWager(format);
                        setApproved(false);
                      }}
                    >
                      <Icon
                        name={
                          format === 'friendly'
                            ? 'Swords'
                            : format === 'pokemon'
                              ? 'Pokeball'
                              : 'Wallet'
                        }
                        size={19}
                      />
                      <strong>
                        {format === 'friendly'
                          ? 'Friendly'
                          : format === 'pokemon'
                            ? 'Pokémon'
                            : format === 'sol'
                              ? 'SOL'
                              : 'Coin tokens'}
                      </strong>
                      <small>
                        {unavailable
                          ? 'Unavailable'
                          : format === 'friendly'
                            ? 'Just for fun'
                            : format === 'pokemon'
                              ? 'Wager your team'
                              : 'Equal deposits'}
                      </small>
                    </button>
                  );
                })}
              </div>
              {mode !== 'demo' && (caps?.sol !== true || caps?.token !== true) && (
                <p className="online-escrow-note">
                  {caps
                    ? caps.monetaryWagerReason ||
                      (caps.sol
                        ? 'SOL battles are ready. Token battles will appear when a supported coin is available.'
                        : 'SOL and token battles are waiting for their payment setup.')
                    : online.capabilitiesError
                      ? 'We couldn’t check wager availability. Please try again shortly.'
                      : 'Checking wager availability…'}
                </p>
              )}
              {(wager === 'sol' || wager === 'token') && (
                <div className="online-money-fields">
                  {wager === 'token' && (
                    <label>
                      Coin token
                      <select
                        value={tokenMint}
                        onChange={(event) => {
                          setTokenMint(event.target.value);
                          setApproved(false);
                        }}
                      >
                        {caps?.tokens?.map((token) => (
                          <option key={token.mint} value={token.mint}>
                            {token.symbol} · {token.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Your stake{' '}
                    <span>{wager === 'sol' ? 'SOL' : selectedToken?.symbol || 'tokens'}</span>
                    <input
                      aria-label="Wager amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        setApproved(false);
                      }}
                      placeholder="0.00"
                    />
                  </label>
                  {selectedToken && wager === 'token' && (
                    <small title={selectedToken.mint}>
                      Token: {shortWallet(selectedToken.mint)}
                    </small>
                  )}
                  {amountError && (
                    <p className="online-error" role="alert">
                      {amountError}
                    </p>
                  )}
                </div>
              )}
              <div className="online-visibility-toggle" aria-label="Room visibility">
                <button
                  type="button"
                  aria-pressed={visibility === 'public'}
                  onClick={() => setVisibility('public')}
                >
                  <Icon name="Users" size={14} />
                  Public room
                </button>
                <button
                  type="button"
                  aria-pressed={visibility === 'invite'}
                  onClick={() => setVisibility('invite')}
                >
                  <Icon name="Lock" size={14} />
                  Invite only
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="online-open-rooms" aria-label="Open battle rooms">
                {roomPage.items.map((item) => (
                  <button
                    type="button"
                    className={joinId === item.id ? 'selected' : ''}
                    key={item.id}
                    onClick={() => {
                      setJoinId(item.id);
                      setInvite('');
                      setApproved(false);
                    }}
                  >
                    <span className="online-room-mini">
                      <Icon name="Pokeball" size={22} />
                    </span>
                    <span>
                      <strong>{item.hostName}</strong>
                      <small>
                        {item.teamSize} Pokémon · {battleWagerLabel(item)}
                      </small>
                    </span>
                    <Icon name="ChevronRight" size={15} />
                  </button>
                ))}
                {!rooms.length && (
                  <div className="online-no-rooms">
                    <Icon name="Swords" size={25} />
                    <p>
                      {eligible
                        ? 'No open rooms yet. Create one or use an invitation.'
                        : 'Available rooms appear after sign-in.'}
                    </p>
                  </div>
                )}
              </div>
              <ListMore {...roomPage} label="Load more battle rooms" />
              <details
                className="online-invitation"
                open={Boolean(invite || (joinId && !rooms.some((item) => item.id === joinId)))}
              >
                <summary>
                  Have an invitation? <Icon name="ChevronDown" size={13} />
                </summary>
                <label>
                  Room ID
                  <input
                    value={joinId}
                    onChange={(event) => {
                      setJoinId(event.target.value);
                      setApproved(false);
                    }}
                    placeholder="Paste the room ID"
                  />
                </label>
                <label>
                  Invitation code
                  <input
                    value={invite}
                    onChange={(event) => setInvite(event.target.value)}
                    placeholder="For private rooms"
                  />
                </label>
              </details>
              {loadingPreview && <ContentSkeleton kind="rows" label="Loading room details" />}
              {previewError && (
                <p className="online-error" role="alert">
                  {previewError}
                </p>
              )}
              {preview && (
                <div className="online-room-terms">
                  <span>Joining {preview.hostName}</span>
                  <strong>{battleWagerLabel(preview)}</strong>
                  <p>
                    Bring exactly {preview.teamSize} Pokémon.
                    {preview.wager === 'friendly'
                      ? ' Your Pokémon stay yours.'
                      : preview.wager === 'pokemon'
                        ? ' The winner takes both selected teams.'
                        : ' Both trainers fund this same stake before the match begins.'}
                  </p>
                  {ids.length !== preview.teamSize && (
                    <button type="button" onClick={() => setMobilePanel('team')}>
                      Choose {preview.teamSize} Pokémon <Icon name="ArrowRight" size={13} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {risk && (
            <label className="online-wager-consent">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
              />
              <span>
                {activeWager === 'pokemon'
                  ? 'I understand that losing or forfeiting transfers every selected Pokémon to the winner.'
                  : 'I accept these exact stakes. Losing or forfeiting gives the winner the wagered funds; funding requires a separate wallet approval.'}
              </span>
            </label>
          )}
          {online.error && (
            <p className="online-error" role="alert">
              {online.error}
            </p>
          )}
        </div>
        <footer className="online-desk-submit">
          <div>
            <strong>{ids.length} Pokémon selected</strong>
            <span>
              {ids.length
                ? 'Your first Pokémon leads the battle.'
                : 'Choose your party to continue.'}
            </span>
          </div>
          <Button
            className="full-width"
            disabled={
              !enabled ||
              !permitted ||
              caps?.reviewRequired !== true ||
              !ids.length ||
              online.pending ||
              (risk && !approved) ||
              (desk === 'join' && !joinValid) ||
              (desk === 'create' && monetary && Boolean(amountError))
            }
            onClick={() =>
              desk === 'join' ? void join() : void online.create(ids, wager, visibility, terms)
            }
          >
            {online.pending
              ? 'Saving your room…'
              : desk === 'join'
                ? 'Join this room'
                : 'Create room'}
            <Icon name="ArrowRight" size={16} />
          </Button>
          <small>
            {enabled && caps && caps.reviewRequired !== true
              ? 'The battle server needs the room-review update before new matches can start.'
              : 'Both trainers review and accept before the match starts.'}
          </small>
        </footer>
      </aside>
    </section>
  );
}
