pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin.org/contracts/access/Ownable.sol";

contract ScoreToken is ERC20, Ownable {
    uint256 public constant PRICE_PER_10 = 0.002 ether;

    constructor() ERC20("ScoreUp Credit", "SCORE") Ownable(msg.sender) {}

    function buyCredits() public payable {
        require(msg.value >= PRICE_PER_10, "Send 0.002 ETH for 10 credits");
        _mint(msg.sender, 10);
        payable(owner()).transfer(msg.value);
    }

    function burnCredit(address user) public onlyOwner {
        _burn(user, 1);
    }
}
