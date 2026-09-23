const Voting = artifacts.require("Voting");

module.exports = function (deployer) {
  // The account that runs this migration becomes the contract owner (administrator).
  const title = process.env.ELECTION_TITLE || "ChainVote Election";
  deployer.deploy(Voting, title);
};
