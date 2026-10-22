import type { ReactNode } from 'react';
import { Icon } from '../components/UI';
import { legalContactEmail, siteConfig } from '../site-config';

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Contact() {
  const email = legalContactEmail();
  return (
    <dl className="legal-contact">
      <div>
        <dt>Operator</dt>
        <dd>{siteConfig.operator || 'Operator details to be added'}</dd>
      </div>
      <div>
        <dt>Contact</dt>
        <dd>
          {email ? (
            <a href={'mailto:' + encodeURIComponent(email)}>{email}</a>
          ) : (
            'Contact email to be added'
          )}
        </dd>
      </div>
    </dl>
  );
}

export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const privacy = kind === 'privacy';
  return (
    <article className="legal-page">
      <a href="#/discover" className="legal-back">
        <Icon name="ArrowLeft" size={17} />
        Back to Kanto
      </a>
      <header className="legal-heading">
        <span className="legal-kicker">Kanto / {privacy ? 'Privacy' : 'Terms'}</span>
        <h1>{privacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
        <p>
          {privacy
            ? 'How information is used when you explore, collect and play.'
            : 'The terms for using Kanto and its connected features.'}
        </p>
        <div className="legal-meta">
          <span>Draft</span>
          <time dateTime="2026-10-21">Updated 21 October 2026</time>
        </div>
      </header>
      <div className="legal-draft-note">
        This draft describes the current Kanto features. Operator details, service providers,
        applicable legal requirements and retention arrangements must be confirmed before public
        launch.
      </div>
      {privacy ? <PrivacyContent /> : <TermsContent />}
      <LegalSection title="Contact">
        <p>
          For questions about these terms or requests about your personal information, contact the
          operator below. Never send a private key or recovery phrase.
        </p>
        <Contact />
      </LegalSection>
      <a className="legal-other" href={privacy ? '#/terms' : '#/privacy'}>
        {privacy ? 'Terms of Service' : 'Privacy Policy'}
        <Icon name="ArrowRight" size={17} />
      </a>
    </article>
  );
}

function TermsContent() {
  return (
    <>
      <LegalSection title="Using Kanto">
        <p>
          Kanto connects wallet-based coin launches, token activity, Pokémon collections, rewards
          and battles. These terms cover your use of the service. You must be able to enter a
          binding agreement and meet the age and other eligibility requirements that apply to the
          features you use in your location.
        </p>
        <p>
          Demo mode uses sample balances and local game data. Demo Pokémon, token balances, rewards
          and payouts have no redeemable real-world value.
        </p>
      </LegalSection>
      <LegalSection title="Your wallet and profile">
        <p>
          You control your wallet and are responsible for keeping it secure. Signing in proves
          control of your address; it does not itself approve a transaction. Review each transaction
          and its destination, amount and fees before signing. Kanto does not need your wallet’s
          private key or recovery phrase.
        </p>
        <p>
          Use accurate profile and coin information, and only upload content you are entitled to
          share. Do not impersonate others or publish unlawful content. Your wallet address, public
          profile and some game activity may be visible to other users.
        </p>
      </LegalSection>
      <LegalSection title="Coins, transactions and fees">
        <p>
          Live coin launches and trades use connected Solana and Pump infrastructure. Wallets,
          networks and third-party services have their own terms. Blockchain transactions may be
          irreversible, fail or remain pending. Token prices can change sharply, and you may lose
          the amount you spend. Kanto does not promise investment returns or liquidity.
        </p>
        <p>
          Kanto’s creator-fee allocation is 30% to the coin creator, 20% to the platform and 50% to
          holder rewards. This split applies to creator fees actually collected, not total trading
          volume. Network and other provider fees may also apply; review the amounts presented for
          your transaction.
        </p>
      </LegalSection>
      <LegalSection title="Rewards, collections and redemption">
        <p>
          Reward eligibility depends on the applicable coin, holdings, holding history and funded
          reward pool. Eggs and packs use random outcomes within that pool’s limits. Holding a token
          does not guarantee a particular Pokémon, reward frequency, evolution or financial return.
          Available reward tables and conditions are shown in the app.
        </p>
        <p>
          Game collections are recorded by Kanto; a Pokémon is not automatically an on-chain token
          or NFT. Eligible live Pokémon can be redeemed for their recorded funded SOL amount,
          subject to ownership, locks and settlement checks. A displayed reference or catalogue
          value is not an offer to buy. Pending payouts are not completed payments. Network or
          service interruptions can delay settlement.
        </p>
      </LegalSection>
      <LegalSection title="Battles and fair play">
        <p>
          Practice battles are for fun. If a live wager feature is enabled, both players must review
          and accept the same rules, team and stake. A loss or surrender can transfer the agreed
          SOL, tokens or Pokémon to the winner. Do not enter a wager you cannot afford to lose.
          Availability does not establish eligibility in every location.
        </p>
        <p>
          Do not exploit bugs, falsify walking or location data, manipulate reward eligibility,
          automate abusive activity or interfere with another player’s account. Kanto may restrict
          affected features while investigating abuse or resolving disputed state. Restrictions do
          not remove rights you have under applicable law.
        </p>
      </LegalSection>
      <LegalSection title="Availability and third-party material">
        <p>
          Features may be updated, interrupted or unavailable. Kanto cannot guarantee continuous
          access or the operation of external wallets, networks and providers. Nothing in these
          terms excludes liability or consumer rights that cannot lawfully be excluded.
        </p>
        <p>
          The Kanto copyright notice applies only to material owned by its operator. Pokémon
          characters, names, artwork and other third-party material remain the property of their
          respective owners. Their appearance does not imply affiliation or endorsement.
        </p>
      </LegalSection>
      <LegalSection title="Changes and leaving">
        <p>
          Material changes to these terms will be identified with an updated date and a notice in
          the service. Changes do not retrospectively alter an already accepted battle stake or a
          completed transaction. You can stop using Kanto and disconnect your wallet at any time;
          disconnecting does not reverse transactions or erase public blockchain records. Data
          requests are described in the Privacy Policy.
        </p>
      </LegalSection>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <LegalSection title="Who is responsible">
        <p>
          The Kanto operator identified in the contact section is responsible for personal
          information handled by the service. This draft covers Kanto’s frontend and connected
          backend. External wallets, Pump, blockchain services and linked websites handle
          information under their own policies.
        </p>
      </LegalSection>
      <LegalSection title="Information used by the service">
        <p>
          When you connect, Kanto uses your public wallet address, a signed sign-in message and
          session records. It reads relevant public holdings and transactions to verify eligibility
          and process requested actions. It does not ask for your wallet’s private key or recovery
          phrase.
        </p>
        <p>
          Your account may include a display name, trainer image, banner, settings, collection,
          rewards, Rare Candy, gym participation, battle results, room messages and transaction
          receipts. Coin creators can submit coin images, descriptions and social links. Requests
          can also produce technical and security information such as IP addresses, request times
          and errors.
        </p>
      </LegalSection>
      <LegalSection title="Optional walking and location">
        <p>
          Walking is optional and requires mobile browser location permission. During an active
          session, Kanto sends location samples, accuracy, timestamps and device capability
          information to check plausible movement and calculate egg progress. You can stop the
          session or revoke location permission to stop new samples.
        </p>
        <p>
          The backend keeps a latest location anchor while checking a session, together with
          accepted distance and records that prevent repeated sample submissions. Ending a session
          clears its location anchor; distance and reward progress remain. Precise walking
          coordinates are not part of your public trainer profile. Location checks reduce abuse but
          cannot prove that every reported journey is genuine.
        </p>
      </LegalSection>
      <LegalSection title="Why information is used">
        <p>
          Information supports wallet sign-in, profiles, holdings checks, rewards, walking, battles,
          transactions, account recovery and abuse prevention. For a live service, the operator must
          confirm the lawful basis for each purpose: providing requested services, consent for
          optional location processing, legitimate interests in service security where applicable,
          and any legal obligations.
        </p>
        <p>
          Optional walking can be stopped without giving up browsing or other available account
          features. Location permission alone does not authorize a wallet transaction.
        </p>
      </LegalSection>
      <LegalSection title="Browser storage and cookies">
        <p>
          Kanto uses browser storage for settings, watchlists, local demo progress, saved teams,
          dismissed prompts and pending transaction recovery. A connected backend can issue a
          secure, HTTP-only session cookie. Kanto also saves a temporary sign-in token and your
          chosen wallet in this tab’s session storage so refreshing can restore your sign-in,
          including when cross-site cookies are blocked. The server validates the session before
          restoring it. Disconnecting clears the saved sign-in. Wallet private keys are never stored
          by Kanto.
        </p>
        <p>
          Clearing browser data removes locally stored preferences and demo progress, but does not
          delete server records or blockchain transactions. Disconnect your wallet to end the app
          session. External services may use their own cookies or storage.
        </p>
      </LegalSection>
      <LegalSection title="Public information and service providers">
        <p>
          Public trainer profiles, wallet addresses, coin details and selected trainer activity can
          be visible to others. Linking a name or image to a wallet can connect your profile to its
          public transaction history. Blockchain information is public and generally cannot be
          changed or deleted by Kanto.
        </p>
        <p>
          Hosting, database, network and transaction providers receive information needed to operate
          their part of the service. Information may also need to be disclosed to meet legal
          obligations or protect users against abuse. Before public launch, the operator must
          identify actual provider categories, processing locations and safeguards for any
          international transfers.
        </p>
      </LegalSection>
      <LegalSection title="How long information is kept">
        <p>
          Account, collection and ledger records are needed to maintain ownership, balances, rewards
          and settlement history. Retention should be limited to those purposes, resolving disputes
          and applicable record-keeping duties. The operator must set retention periods for those
          records and technical logs before public launch.
        </p>
        <p>
          Sign-in challenges expire after five minutes and sessions after seven days; background
          cleanup removes expired records after a further cleanup period. Browser preferences remain
          until changed or cleared. Public blockchain records remain on the network independently of
          Kanto.
        </p>
      </LegalSection>
      <LegalSection title="Your choices and rights">
        <p>
          Use Settings to update your profile and preferences. You can disconnect your wallet, stop
          walking, revoke location permission and clear browser storage. Where applicable law
          provides these rights, you may request access, correction, deletion, restriction or a
          portable copy of your information, and withdraw consent for optional processing.
        </p>
        <p>
          <strong>
            You may also object to processing based on legitimate interests where that right
            applies.
          </strong>{' '}
          Contact the operator to make a request. Wallet control may need to be verified without
          asking for secret keys. Some information may need to be retained to complete obligations,
          and Kanto cannot erase public blockchain records.
        </p>
        <p>
          You may complain to the data protection authority in your location. In the UK, this is the{' '}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">
            Information Commissioner’s Office
          </a>
          .
        </p>
      </LegalSection>
      <LegalSection title="Policy updates">
        <p>
          The date above identifies the latest draft. Material changes to data handling should be
          explained in the app before they take effect, with any required consent requested
          separately.
        </p>
      </LegalSection>
    </>
  );
}
