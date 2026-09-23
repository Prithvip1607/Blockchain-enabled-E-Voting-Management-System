# ChainVote

**ChainVote: Blockchain-enabled E-Voting Management System using Ethereum and Solidity**

An academic prototype that shows how an Ethereum smart contract can enforce election rules, count votes
and expose a publicly verifiable record. It runs on the **Ethereum Sepolia testnet** (chain ID `11155111`).

> This is a learning/demonstration project, not a production election system. See [Limitations](#limitations).

---

## Status of this build (read first)

| Part | State |
| --- | --- |
| `contracts/Voting.sol` | Written. **Not yet compiled or tested by the author of this build** (no Solidity toolchain was available). Run `npm test` first. |
| `test/voting.test.js` (44 tests) | Written. **Not yet run.** |
| `backend/` (FastAPI + MySQL) | Written. `backend/tests` (13 tests) **not yet run**. |
| Frontend (`src/`) | Written. Its logic was exercised in a browser against a **stubbed** ethers/MetaMask (44 checks passed). It has **not** been run against real MetaMask or Sepolia. |
| Deployment to Sepolia | **Not done.** You deploy with your own wallet and RPC key (below). |

Nothing in the app fakes blockchain behaviour: hashes, block numbers and Etherscan links come from real
transaction receipts, and if Sepolia is unreachable the UI says so. Until you have run the steps under
[Testing](#testing) and [Deployment](#smart-contract-deployment) yourself, treat the acceptance checklist
as *unverified*.

---

## Architecture

```text
User
 ↓
ChainVote frontend (HTML / CSS / JavaScript, served by FastAPI)
 ├── FastAPI ──► MySQL                     application accounts (off-chain)
 │
 └── MetaMask ─► ethers.js ─► Voting.sol ─► Ethereum Sepolia ─► Etherscan
```

| Layer | Responsibility |
| --- | --- |
| **Ethereum (Voting.sol)** | Owner/admin rights, election ID and title, schedule, candidates, vote counts, one-wallet-one-vote, events. The **authoritative** source for all voting data. |
| **FastAPI + MySQL** | Registration, login (bcrypt + JWT), account management. **Never** stores or counts votes. |
| **MetaMask** | Holds the user's keys and signs every transaction. No private key exists in the frontend or backend. |

*Application login ≠ wallet authorization.* A user signs in to ChainVote with a voter ID, and separately
connects MetaMask. Voting and administration are enforced by the contract, using the wallet address.

## Technologies

* Frontend: HTML, CSS, JavaScript (no build step), ethers.js v6, Chart.js
* Blockchain: Ethereum Sepolia, Solidity 0.8.19, Truffle, MetaMask
* Backend: Python, FastAPI, SQLAlchemy, bcrypt, PyJWT
* Database: MySQL

## What the contract enforces

* `onlyOwner` on `addCandidate`, `deleteCandidate`, `setDates`, `setElectionTitle`, `resetElection`, `transferOwnership`. The deployer is the owner.
* Voting only between start and end time (block time); only active candidates; **one vote per wallet per election**.
* Candidates, title and schedule are **frozen once voting opens**, so an admin cannot change the ballot mid-election.
* At least two candidates before an election can be scheduled; duplicate candidate names (case-insensitive) rejected; length limits.
* `resetElection` starts a new election (new ID). It is refused while voting is active.
* Events: `ElectionCreated`, `ElectionTitleUpdated`, `CandidateAdded`, `CandidateRemoved`, `ElectionDatesUpdated`, `VoteCast`, `ElectionReset`, `OwnershipTransferred`.

## Project structure

```text
ChainVote/
├── contracts/            Voting.sol, Migrations.sol
├── migrations/           1_initial_migration.js, 2_deploy_voting.js
├── test/                 voting.test.js
├── scripts/              export-frontend.js (writes src/deployment.json), vendor.js
├── backend/              main.py, security.py, create_admin.py, database/, tests/, requirements.txt
├── src/
│   ├── html/             login, signup, voter, admin, results
│   ├── css/theme.css
│   ├── js/               config, chain, auth, ui, shell, election, verify, results, voter, admin ...
│   └── deployment.json   generated after deployment (contract address + ABI)
├── .env.example  .gitignore  package.json  truffle-config.js  pytest.ini
```

The frontend is plain static files served by the FastAPI app (same origin, so no CORS setup).
If you already have an Express server, you can keep serving `src/` from it; set `API_BASE` in `src/js/config.js`.

---

## Installation

Requirements: Node.js 18+, Python 3.10+, MySQL 8, the MetaMask browser extension.

```bash
git clone <your-repo> ChainVote && cd ChainVote

# 1. JavaScript dependencies (also copies ethers + chart.js into src/vendor)
npm install

# 2. Python dependencies
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# 3. Configuration
cp .env.example .env                 # then edit .env (see below)
```

### Environment configuration (`.env`, never committed)

| Variable | Used by | Meaning |
| --- | --- | --- |
| `SEPOLIA_RPC_URL` | Truffle, export script | HTTPS endpoint of a Sepolia RPC provider (Infura, Alchemy, QuickNode…). Contains your API key, so it stays on your machine. |
| `DEPLOYER_PRIVATE_KEY` | Truffle | Private key of a **throw-away test wallet** holding Sepolia ETH. This wallet becomes the contract **owner**. Never use a wallet with real funds. |
| `ELECTION_TITLE` | Truffle | Title stored in the contract at deployment. |
| `JWT_SECRET` | Backend | 32+ random characters. `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `JWT_EXPIRE_MINUTES` | Backend | Session lifetime (default 60). |
| `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` | Backend | MySQL connection. Or set `DATABASE_URL` to override. |
| `CORS_ORIGINS` | Backend | Only if the frontend is served from another origin. |

The browser never sees any of these. The frontend reads only the public `src/deployment.json`
(address + ABI) and a key-less public read RPC set in `src/js/config.js`.

### MySQL

```sql
CREATE DATABASE chainvote CHARACTER SET utf8mb4;
CREATE USER 'chainvote'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX ON chainvote.* TO 'chainvote'@'localhost';
```

Tables are created automatically on first start (`backend/database/schema.sql` is the reference).
Passwords are stored as bcrypt hashes. If you are migrating from an older version that stored plain-text passwords, those accounts cannot be converted: users must sign up again.

Create the first administrator (prompts for the password; never put it in a file):

```bash
python -m backend.create_admin
```

## Testing

```bash
npm test                       # Solidity tests (Truffle's built-in in-process test chain, not Sepolia)
pytest                         # backend tests (in-memory SQLite, no MySQL needed)
```

`npm test` compiles `Voting.sol` with solc 0.8.19 (downloaded by Truffle) and runs 44 tests: deployment,
owner-only functions, candidate validation, schedule rules, timing (before/during/after), one-wallet-one-vote,
results, reset, ownership transfer. **Fix any failure here before deploying.**

## MetaMask setup

1. Install MetaMask and create/import a wallet.
2. Open the network selector and enable **Sepolia** (under "Show test networks"), or let ChainVote add it: the app offers a *Switch network* button.
3. Import the **deployer** account into MetaMask (Account menu → Import account → paste the private key of the throw-away wallet). This is the admin wallet.
4. Use a second MetaMask account for voting.

## Sepolia ETH

Every transaction (deploy, add candidate, vote…) costs a small fee in **Sepolia test ETH**, which has no monetary value.
Get some from a Sepolia faucet (search "Sepolia faucet"; providers such as Alchemy, Infura and Google Cloud offer them). Fund both the admin wallet and each voting wallet.

## Smart contract deployment

```bash
npm test                     # 1. compile + run tests
npm run deploy:sepolia       # 2. deploy with the wallet in DEPLOYER_PRIVATE_KEY
npm run export:frontend      # 3. write src/deployment.json (address + ABI, public data only)
```

The last command prints the contract address and its Sepolia Etherscan URL. If you redeploy, run steps 2 and 3
again: that is the **only** place the address is stored. The deployer wallet must hold Sepolia ETH.

## Running the application

```bash
uvicorn backend.main:app --reload
# open http://localhost:8000
```

Sign up at `/html/signup.html`, sign in, and connect MetaMask. Public read-only results are at `/html/results.html` (no login, no wallet).

---

## Demonstration (5–10 minutes)

1. **Start.** Open ChainVote and show the login page.
2. **Admin wallet.** Sign in as the admin; connect MetaMask with the *deployer* account on Sepolia. The Blockchain panel shows *Wallet Authorized (contract owner)*.
3. **Setup (real transactions).** *Candidates*: add two or three candidates (confirm each in MetaMask, watch the transaction tracker). *Election*: press **Open now for 1 hour** and save. Note that candidates and dates are now locked.
4. **Voter.** In a private window, sign up and sign in as a voter; connect the second MetaMask account. The dashboard shows *Voting active* with a countdown.
5. **Vote.** Choose a candidate, review, confirm in MetaMask, wait for confirmation. The receipt shows the transaction hash, block number and network.
6. **Duplicate vote.** The ballot now says you already voted. To show the contract itself refusing, run `Chain.vote(1)` in the browser console: it is rejected with "You have already voted".
7. **Non-owner.** Connect the voter wallet on the admin page: *You are not authorized to perform blockchain administration.* Buttons are disabled, and the contract would reject the transaction anyway.
8. **Results.** Open *Results*: counts and percentages come from the contract.
9. **Etherscan.** Open *Blockchain* → *View latest transaction on Sepolia Etherscan* and explain: *"This transaction was recorded on Ethereum Sepolia."*

## Viva preparation

* **Why Ethereum?** A programmable public blockchain: smart contracts enforce the rules automatically and anyone can audit them.
* **Why Solidity?** It is the main language for Ethereum contracts; `Voting.sol` implements the election rules.
* **Why MetaMask?** It manages the user's keys and signs transactions, so the app never touches private keys.
* **Why Sepolia?** A public test network: realistic behaviour and Etherscan visibility without real money.
* **Why FastAPI and MySQL?** Off-chain application data (accounts, login) that does not need to be public or immutable.
* **What is on the blockchain?** Election, candidates, vote counts, who has voted (as wallet addresses) and admin ownership.
* **What stops double voting?** `voters[electionId][msg.sender]` in the contract; a second `vote()` reverts.
* **Who is the admin?** The wallet that deployed the contract (`owner`), enforced by `onlyOwner`, not by the app login.
* **Why are candidates locked after voting starts?** So an admin can't change the ballot during an election.
* **How is the result verified?** Read `getCandidate`, or check the `VoteCast` events and transactions on Etherscan.
* **What is `staticCall` used for?** A dry run before MetaMask opens, so revert reasons show as friendly messages.

## Security

* Authorization for blockchain actions is in the contract (`onlyOwner`); the frontend checks only give earlier feedback.
* No private keys in browser code, the backend or the repository. `.env` is git-ignored; `.env.example` has no secrets.
* Passwords: bcrypt hashes; public sign-up can only create ordinary voters; admins are created from the command line; the JWT secret must be set (the app refuses to start without one); login errors don't reveal whether a voter ID exists.
* Backend sends CSP, `X-Frame-Options`, `nosniff` and `no-referrer` headers; all scripts are served locally (no CDN).
* Use a throw-away deployer wallet, and never reuse it on Ethereum Mainnet.

## Limitations

* **Academic prototype.** No formal audit; not suitable for real elections.
* **Not secret and not anonymous.** Votes are public transactions tied to wallet addresses; results are readable during voting.
* **Identity is not bound to wallets.** The contract limits one vote per *wallet*. Nothing stops one person from using several wallets, and nothing links a voter ID to a wallet (Sybil resistance / voter-eligibility proofs are out of scope).
* **Centralized parts.** Accounts and login run on your FastAPI/MySQL server. The static site and deployment are also centrally hosted. Only election state and votes are decentralized.
* **Admin trust.** The owner controls candidates, schedule and reset (before voting starts). Ownership is a single wallet.
* **Time.** Start and end use block timestamps, which miners/validators can shift by a few seconds.
* **Public RPC.** Results are read through a public Sepolia RPC or MetaMask's provider; availability depends on them. Some RPCs limit log ranges, in which case the vote receipt falls back to the browser's local copy.
* **Sessions.** The JWT is kept in `localStorage`, which is exposed to any XSS bug.
* **Testnet only.** Do not deploy to Mainnet.
