// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChainVote Voting contract
 * @notice Academic prototype of a blockchain e-voting contract.
 *
 * ON-CHAIN (this contract): election state and schedule, candidates, vote counts,
 * one-wallet-one-vote tracking, administrator authorisation, events.
 * OFF-CHAIN (FastAPI + MySQL): account registration and login only.
 *
 * Votes are public. This prototype does not provide ballot secrecy.
 *
 * Revert strings are part of the frontend contract (src/js/chain.js maps them to
 * user-friendly messages). Keep them in sync if you change them.
 */
contract Voting {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------
    enum Status { NotScheduled, NotStarted, Active, Closed }

    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
        bool active;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    address public owner;

    uint256 public electionId;            // current election, starts at 1
    string public electionTitle;
    uint256 public startTime;             // unix seconds, 0 = not scheduled
    uint256 public endTime;               // unix seconds, inclusive
    uint256 public candidatesCount;       // ids issued in the current election (1..count)
    uint256 public activeCandidatesCount; // candidates not removed
    uint256 public totalVotes;            // votes cast in the current election

    // electionId => candidateId => Candidate
    mapping(uint256 => mapping(uint256 => Candidate)) private candidates;
    // electionId => wallet => has voted
    mapping(uint256 => mapping(address => bool)) public voters;
    // electionId => keccak256(lowercased name) => in use (duplicate prevention)
    mapping(uint256 => mapping(bytes32 => bool)) private nameTaken;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------
    event ElectionCreated(uint256 indexed electionId, string title);
    event ElectionTitleUpdated(uint256 indexed electionId, string title);
    event CandidateAdded(uint256 indexed electionId, uint256 candidateId, string name);
    event CandidateRemoved(uint256 indexed electionId, uint256 candidateId);
    event ElectionDatesUpdated(uint256 indexed electionId, uint256 startTime, uint256 endTime);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);
    event ElectionReset(uint256 indexed oldElectionId, uint256 indexed newElectionId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------
    modifier onlyOwner() {
        require(msg.sender == owner, "Only admin can perform this action");
        _;
    }

    /// Candidates, title and schedule are frozen once voting has opened.
    modifier beforeVotingStarts() {
        require(startTime == 0 || block.timestamp < startTime, "Voting has already started");
        _;
    }

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------
    constructor(string memory _title) {
        require(bytes(_title).length > 0 && bytes(_title).length <= 100, "Invalid title");
        owner = msg.sender;
        electionId = 1;
        electionTitle = _title;
        emit ElectionCreated(1, _title);
    }

    // ------------------------------------------------------------------
    // Administration (owner only)
    // ------------------------------------------------------------------
    function setElectionTitle(string memory _title) public onlyOwner beforeVotingStarts {
        require(bytes(_title).length > 0 && bytes(_title).length <= 100, "Invalid title");
        electionTitle = _title;
        emit ElectionTitleUpdated(electionId, _title);
    }

    function addCandidate(string memory _name, string memory _party) public onlyOwner beforeVotingStarts {
        require(bytes(_name).length > 0 && bytes(_name).length <= 60, "Invalid candidate name");
        require(bytes(_party).length > 0 && bytes(_party).length <= 60, "Invalid party name");

        bytes32 key = _nameKey(_name);
        require(!nameTaken[electionId][key], "Candidate already exists");
        nameTaken[electionId][key] = true;

        candidatesCount += 1;
        activeCandidatesCount += 1;
        candidates[electionId][candidatesCount] = Candidate(candidatesCount, _name, _party, 0, true);

        emit CandidateAdded(electionId, candidatesCount, _name);
    }

    function deleteCandidate(uint256 _id) public onlyOwner beforeVotingStarts {
        require(_id >= 1 && _id <= candidatesCount, "Invalid candidate");
        Candidate storage c = candidates[electionId][_id];
        require(c.active, "Candidate is not active");

        c.active = false;
        activeCandidatesCount -= 1;
        nameTaken[electionId][_nameKey(c.name)] = false;

        emit CandidateRemoved(electionId, _id);
    }

    function setDates(uint256 _start, uint256 _end) public onlyOwner beforeVotingStarts {
        require(_start > 0, "Invalid start time");
        require(_end > _start, "End time must be after start time");
        require(_end > block.timestamp, "End time must be in the future");
        require(activeCandidatesCount >= 2, "At least two candidates are required");

        startTime = _start;
        endTime = _end;
        emit ElectionDatesUpdated(electionId, _start, _end);
    }

    /// Starts a new election: new id, no candidates, no schedule, all wallets may vote again.
    /// Results of previous elections stay on-chain in the event log and storage.
    function resetElection() public onlyOwner {
        require(getStatus() != Status.Active, "Cannot reset while voting is active");

        uint256 oldId = electionId;
        electionId = oldId + 1;
        startTime = 0;
        endTime = 0;
        candidatesCount = 0;
        activeCandidatesCount = 0;
        totalVotes = 0;

        emit ElectionReset(oldId, electionId);
        emit ElectionCreated(electionId, electionTitle);
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, _newOwner);
        owner = _newOwner;
    }

    // ------------------------------------------------------------------
    // Voting
    // ------------------------------------------------------------------
    function vote(uint256 _candidateId) public {
        require(startTime != 0, "Election is not scheduled");
        require(block.timestamp >= startTime, "Election has not started");
        require(block.timestamp <= endTime, "Election has ended");
        require(_candidateId >= 1 && _candidateId <= candidatesCount, "Invalid candidate");

        Candidate storage c = candidates[electionId][_candidateId];
        require(c.active, "Candidate is not active");
        require(!voters[electionId][msg.sender], "You have already voted");

        voters[electionId][msg.sender] = true;
        c.voteCount += 1;
        totalVotes += 1;

        emit VoteCast(electionId, _candidateId, msg.sender);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------
    function getStatus() public view returns (Status) {
        if (startTime == 0) return Status.NotScheduled;
        if (block.timestamp < startTime) return Status.NotStarted;
        if (block.timestamp <= endTime) return Status.Active;
        return Status.Closed;
    }

    function getCountCandidates() public view returns (uint256) {
        return candidatesCount;
    }

    /// Returns (id, name, party, voteCount, active) for candidate _id of the current election.
    function getCandidate(uint256 _id) public view returns (uint256, string memory, string memory, uint256, bool) {
        require(_id >= 1 && _id <= candidatesCount, "Invalid candidate");
        Candidate storage c = candidates[electionId][_id];
        return (c.id, c.name, c.party, c.voteCount, c.active);
    }

    function getDates() public view returns (uint256, uint256) {
        return (startTime, endTime);
    }

    /// Whether the caller has voted in the current election.
    function checkVote() public view returns (bool) {
        return voters[electionId][msg.sender];
    }

    function hasVoted(address _voter) public view returns (bool) {
        return voters[electionId][_voter];
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------
    /// Case-insensitive (ASCII) key so "Alice" and "alice" count as duplicates.
    function _nameKey(string memory _s) private pure returns (bytes32) {
    bytes memory original = bytes(_s);
    bytes memory lower = new bytes(original.length);

    for (uint256 i = 0; i < original.length; i++) {
        lower[i] = original[i];

        if (lower[i] >= 0x41 && lower[i] <= 0x5A) {
            lower[i] = bytes1(uint8(lower[i]) + 32);
        }
    }

    return keccak256(lower);
    }
}

