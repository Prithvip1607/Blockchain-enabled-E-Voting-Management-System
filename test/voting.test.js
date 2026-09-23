/* Automated tests for contracts/Voting.sol
   Run with:  npx truffle test
   Truffle runs these on its built-in in-process test chain (not on Sepolia). */
const Voting = artifacts.require("Voting");

const rpc = (method, params = []) =>
  new Promise((resolve, reject) =>
    web3.currentProvider.send({ jsonrpc: "2.0", id: Date.now(), method, params }, (err, res) =>
      err ? reject(err) : resolve(res)
    )
  );
const advance = async (seconds) => {
  await rpc("evm_increaseTime", [seconds]);
  await rpc("evm_mine");
};
const chainNow = async () => Number((await web3.eth.getBlock("latest")).timestamp);

async function expectRevert(promise, message) {
  try {
    await promise;
  } catch (e) {
    assert.include(e.message, message, `Expected revert "${message}" but got: ${e.message}`);
    return;
  }
  assert.fail(`Expected revert "${message}" but the call succeeded`);
}

const STATUS = { NotScheduled: 0, NotStarted: 1, Active: 2, Closed: 3 };

contract("Voting", (accounts) => {
  const [owner, alice, bob, carol, dave] = accounts;
  let voting;

  beforeEach(async () => {
    voting = await Voting.new("Test Election", { from: owner });
  });

  // helpers -----------------------------------------------------------
  async function addTwoCandidates() {
    await voting.addCandidate("Aarav Sharma", "Unity Alliance", { from: owner });
    await voting.addCandidate("Meera Nair", "Progress Front", { from: owner });
  }
  /** Schedules the election so it opens in `startIn` seconds and lasts `duration` seconds. */
  async function schedule(startIn = 100, duration = 1000) {
    const now = await chainNow();
    await voting.setDates(now + startIn, now + startIn + duration, { from: owner });
    return now;
  }
  async function openElection() {
    await addTwoCandidates();
    await schedule(100, 1000);
    await advance(101); // now inside the voting window
  }

  // ===================================================================
  describe("Deployment", () => {
    it("deploys and the deployer becomes owner", async () => {
      assert.equal(await voting.owner(), owner);
    });
    it("starts as election 1 with the given title and no schedule", async () => {
      assert.equal((await voting.electionId()).toNumber(), 1);
      assert.equal(await voting.electionTitle(), "Test Election");
      assert.equal((await voting.getStatus()).toNumber(), STATUS.NotScheduled);
      assert.equal((await voting.getCountCandidates()).toNumber(), 0);
    });
    it("emits ElectionCreated", async () => {
      const events = await voting.getPastEvents("ElectionCreated", { fromBlock: 0 });
      assert.equal(events.length, 1);
      assert.equal(events[0].args.title, "Test Election");
    });
    it("rejects an empty title", async () => {
      await expectRevert(Voting.new("", { from: owner }), "Invalid title");
    });
  });

  // ===================================================================
  describe("Authorization (onlyOwner)", () => {
    const ONLY_ADMIN = "Only admin can perform this action";

    it("owner can add a candidate", async () => {
      await voting.addCandidate("Aarav Sharma", "Unity Alliance", { from: owner });
      const c = await voting.getCandidate(1);
      assert.equal(c[0].toNumber(), 1);
      assert.equal(c[1], "Aarav Sharma");
      assert.equal(c[2], "Unity Alliance");
      assert.equal(c[3].toNumber(), 0);
      assert.equal(c[4], true);
    });
    it("non-owner cannot add a candidate", async () => {
      await expectRevert(voting.addCandidate("Mallory", "Evil Party", { from: alice }), ONLY_ADMIN);
    });
    it("owner can remove a candidate", async () => {
      await addTwoCandidates();
      await voting.deleteCandidate(1, { from: owner });
      const c = await voting.getCandidate(1);
      assert.equal(c[4], false);
      assert.equal((await voting.activeCandidatesCount()).toNumber(), 1);
    });
    it("non-owner cannot remove a candidate", async () => {
      await addTwoCandidates();
      await expectRevert(voting.deleteCandidate(1, { from: alice }), ONLY_ADMIN);
    });
    it("non-owner cannot set dates", async () => {
      await addTwoCandidates();
      const now = await chainNow();
      await expectRevert(voting.setDates(now + 10, now + 100, { from: alice }), ONLY_ADMIN);
    });
    it("non-owner cannot reset the election", async () => {
      await expectRevert(voting.resetElection({ from: alice }), ONLY_ADMIN);
    });
    it("non-owner cannot change the title or transfer ownership", async () => {
      await expectRevert(voting.setElectionTitle("Hacked", { from: alice }), ONLY_ADMIN);
      await expectRevert(voting.transferOwnership(alice, { from: alice }), ONLY_ADMIN);
    });
    it("owner can transfer ownership; the old owner loses access", async () => {
      await voting.transferOwnership(alice, { from: owner });
      assert.equal(await voting.owner(), alice);
      await voting.addCandidate("Aarav Sharma", "Unity Alliance", { from: alice });
      await expectRevert(voting.addCandidate("Meera Nair", "Progress Front", { from: owner }), ONLY_ADMIN);
    });
    it("rejects transferring ownership to the zero address", async () => {
      await expectRevert(
        voting.transferOwnership("0x0000000000000000000000000000000000000000", { from: owner }),
        "Invalid address"
      );
    });
  });

  // ===================================================================
  describe("Candidate management", () => {
    it("issues sequential ids starting at 1 and emits CandidateAdded", async () => {
      await addTwoCandidates();
      assert.equal((await voting.getCountCandidates()).toNumber(), 2);
      const events = await voting.getPastEvents("CandidateAdded", { fromBlock: 0 });
      assert.equal(events.length, 2);
      assert.equal(events[1].args.candidateId.toNumber(), 2);
      assert.equal(events[1].args.name, "Meera Nair");
    });
    it("rejects an empty name or party", async () => {
      await expectRevert(voting.addCandidate("", "Party", { from: owner }), "Invalid candidate name");
      await expectRevert(voting.addCandidate("Name", "", { from: owner }), "Invalid party name");
    });
    it("rejects names or parties longer than 60 bytes", async () => {
      const long = "x".repeat(61);
      await expectRevert(voting.addCandidate(long, "Party", { from: owner }), "Invalid candidate name");
      await expectRevert(voting.addCandidate("Name", long, { from: owner }), "Invalid party name");
    });
    it("prevents duplicate candidate names, ignoring case", async () => {
      await voting.addCandidate("Meera Nair", "Progress Front", { from: owner });
      await expectRevert(voting.addCandidate("meera nair", "Other", { from: owner }), "Candidate already exists");
    });
    it("allows re-adding a name after the candidate was removed", async () => {
      await voting.addCandidate("Meera Nair", "Progress Front", { from: owner });
      await voting.deleteCandidate(1, { from: owner });
      await voting.addCandidate("Meera Nair", "Progress Front", { from: owner });
      assert.equal((await voting.getCountCandidates()).toNumber(), 2);
    });
    it("rejects removing an invalid or already removed candidate", async () => {
      await addTwoCandidates();
      await expectRevert(voting.deleteCandidate(0, { from: owner }), "Invalid candidate");
      await expectRevert(voting.deleteCandidate(9, { from: owner }), "Invalid candidate");
      await voting.deleteCandidate(1, { from: owner });
      await expectRevert(voting.deleteCandidate(1, { from: owner }), "Candidate is not active");
    });
    it("emits CandidateRemoved", async () => {
      await addTwoCandidates();
      await voting.deleteCandidate(2, { from: owner });
      const events = await voting.getPastEvents("CandidateRemoved", { fromBlock: 0 });
      assert.equal(events[0].args.candidateId.toNumber(), 2);
    });
    it("getCandidate rejects invalid ids", async () => {
      await expectRevert(voting.getCandidate(1), "Invalid candidate");
    });
  });

  // ===================================================================
  describe("Election schedule", () => {
    it("rejects an end time that is not after the start time", async () => {
      await addTwoCandidates();
      const now = await chainNow();
      await expectRevert(voting.setDates(now + 100, now + 100, { from: owner }), "End time must be after start time");
      await expectRevert(voting.setDates(now + 200, now + 100, { from: owner }), "End time must be after start time");
    });
    it("rejects an end time in the past and a zero start time", async () => {
      await addTwoCandidates();
      const now = await chainNow();
      await expectRevert(voting.setDates(now - 500, now - 100, { from: owner }), "End time must be in the future");
      await expectRevert(voting.setDates(0, now + 100, { from: owner }), "Invalid start time");
    });
    it("requires at least two candidates", async () => {
      await voting.addCandidate("Only One", "Solo", { from: owner });
      const now = await chainNow();
      await expectRevert(voting.setDates(now + 10, now + 100, { from: owner }), "At least two candidates are required");
    });
    it("reports the lifecycle status from block time", async () => {
      await addTwoCandidates();
      assert.equal((await voting.getStatus()).toNumber(), STATUS.NotScheduled);
      await schedule(100, 1000);
      assert.equal((await voting.getStatus()).toNumber(), STATUS.NotStarted);
      await advance(101);
      assert.equal((await voting.getStatus()).toNumber(), STATUS.Active);
      await advance(1000);
      assert.equal((await voting.getStatus()).toNumber(), STATUS.Closed);
    });
    it("stores the dates and emits ElectionDatesUpdated", async () => {
      await addTwoCandidates();
      const now = await schedule(100, 1000);
      const d = await voting.getDates();
      assert.equal(d[0].toNumber(), now + 100);
      assert.equal(d[1].toNumber(), now + 1100);
      const events = await voting.getPastEvents("ElectionDatesUpdated", { fromBlock: 0 });
      assert.equal(events[0].args.startTime.toNumber(), now + 100);
    });
    it("allows rescheduling before voting starts", async () => {
      await addTwoCandidates();
      await schedule(100, 1000);
      await schedule(500, 2000);
      assert.equal((await voting.getStatus()).toNumber(), STATUS.NotStarted);
    });
    it("freezes candidates, title and schedule once voting has started", async () => {
      await openElection();
      const now = await chainNow();
      await expectRevert(voting.addCandidate("Late", "Party", { from: owner }), "Voting has already started");
      await expectRevert(voting.deleteCandidate(1, { from: owner }), "Voting has already started");
      await expectRevert(voting.setElectionTitle("New", { from: owner }), "Voting has already started");
      await expectRevert(voting.setDates(now + 10, now + 5000, { from: owner }), "Voting has already started");
    });
  });

  // ===================================================================
  describe("Election timing", () => {
    it("rejects voting when no election is scheduled", async () => {
      await addTwoCandidates();
      await expectRevert(voting.vote(1, { from: alice }), "Election is not scheduled");
    });
    it("rejects voting before the start time", async () => {
      await addTwoCandidates();
      await schedule(100, 1000);
      await expectRevert(voting.vote(1, { from: alice }), "Election has not started");
    });
    it("accepts voting during the election", async () => {
      await openElection();
      await voting.vote(1, { from: alice });
      assert.equal(await voting.hasVoted(alice), true);
    });
    it("rejects voting after the end time", async () => {
      await openElection();
      await advance(1100);
      await expectRevert(voting.vote(1, { from: alice }), "Election has ended");
    });
  });

  // ===================================================================
  describe("Voting", () => {
    beforeEach(openElection);

    it("counts a vote for a valid candidate", async () => {
      await voting.vote(2, { from: alice });
      const c = await voting.getCandidate(2);
      assert.equal(c[3].toNumber(), 1);
      assert.equal((await voting.totalVotes()).toNumber(), 1);
    });
    it("emits VoteCast with election, candidate and voter", async () => {
      await voting.vote(1, { from: alice });
      const events = await voting.getPastEvents("VoteCast", { fromBlock: 0 });
      assert.equal(events.length, 1);
      assert.equal(events[0].args.electionId.toNumber(), 1);
      assert.equal(events[0].args.candidateId.toNumber(), 1);
      assert.equal(events[0].args.voter, alice);
    });
    it("enforces one wallet, one vote", async () => {
      await voting.vote(1, { from: alice });
      await expectRevert(voting.vote(1, { from: alice }), "You have already voted");
      await expectRevert(voting.vote(2, { from: alice }), "You have already voted");
      assert.equal((await voting.totalVotes()).toNumber(), 1);
    });
    it("lets different wallets vote", async () => {
      await voting.vote(1, { from: alice });
      await voting.vote(1, { from: bob });
      assert.equal((await voting.getCandidate(1))[3].toNumber(), 2);
    });
    it("rejects invalid candidate ids", async () => {
      await expectRevert(voting.vote(0, { from: alice }), "Invalid candidate");
      await expectRevert(voting.vote(99, { from: alice }), "Invalid candidate");
      assert.equal(await voting.hasVoted(alice), false);
    });
    it("exposes the caller's status through checkVote()", async () => {
      assert.equal(await voting.checkVote({ from: alice }), false);
      await voting.vote(1, { from: alice });
      assert.equal(await voting.checkVote({ from: alice }), true);
      assert.equal(await voting.checkVote({ from: bob }), false);
    });
  });

  describe("Voting for a removed candidate", () => {
    it("rejects votes for a candidate removed before the election", async () => {
      await voting.addCandidate("A", "PA", { from: owner });
      await voting.addCandidate("B", "PB", { from: owner });
      await voting.addCandidate("C", "PC", { from: owner });
      await voting.deleteCandidate(2, { from: owner });
      await schedule(100, 1000);
      await advance(101);
      await expectRevert(voting.vote(2, { from: alice }), "Candidate is not active");
      await voting.vote(3, { from: alice });
    });
  });

  // ===================================================================
  describe("Results", () => {
    it("keeps separate, correct counts per candidate", async () => {
      await voting.addCandidate("A", "PA", { from: owner });
      await voting.addCandidate("B", "PB", { from: owner });
      await voting.addCandidate("C", "PC", { from: owner });
      await schedule(100, 1000);
      await advance(101);

      await voting.vote(1, { from: alice });
      await voting.vote(2, { from: bob });
      await voting.vote(2, { from: carol });
      await voting.vote(3, { from: dave });
      await voting.vote(2, { from: owner });

      const counts = [];
      for (let i = 1; i <= 3; i++) counts.push((await voting.getCandidate(i))[3].toNumber());
      assert.deepEqual(counts, [1, 3, 1]);
      assert.equal((await voting.totalVotes()).toNumber(), 5);
    });
  });

  // ===================================================================
  describe("Reset election", () => {
    it("cannot be reset while voting is active", async () => {
      await openElection();
      await expectRevert(voting.resetElection({ from: owner }), "Cannot reset while voting is active");
    });
    it("starts a new election after the previous one closed", async () => {
      await openElection();
      await voting.vote(1, { from: alice });
      await advance(1100);
      await voting.resetElection({ from: owner });

      assert.equal((await voting.electionId()).toNumber(), 2);
      assert.equal((await voting.getStatus()).toNumber(), STATUS.NotScheduled);
      assert.equal((await voting.getCountCandidates()).toNumber(), 0);
      assert.equal((await voting.totalVotes()).toNumber(), 0);
      assert.equal(await voting.hasVoted(alice), false);

      const events = await voting.getPastEvents("ElectionReset", { fromBlock: 0 });
      assert.equal(events[0].args.oldElectionId.toNumber(), 1);
      assert.equal(events[0].args.newElectionId.toNumber(), 2);
    });
    it("lets a wallet vote again in the new election", async () => {
      await openElection();
      await voting.vote(1, { from: alice });
      await advance(1100);
      await voting.resetElection({ from: owner });
      await addTwoCandidates();
      await schedule(100, 1000);
      await advance(101);
      await voting.vote(1, { from: alice });
      assert.equal((await voting.getCandidate(1))[3].toNumber(), 1);
    });
    it("can be reset before the election has started", async () => {
      await addTwoCandidates();
      await schedule(100, 1000);
      await voting.resetElection({ from: owner });
      assert.equal((await voting.getStatus()).toNumber(), STATUS.NotScheduled);
    });
  });
});
