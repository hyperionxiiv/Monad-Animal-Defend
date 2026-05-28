// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EternalPetz
 * @dev On-chain virtual pet game on Monad where stats decay and actions cost 0.01 MON.
 */
contract EternalPetz {
    address public owner;
    uint256 public constant ACTION_FEE = 0.01 ether;
    uint256 public totalPets;
    
    // Designated recipient wallet for action fees
    address public constant FEE_RECIPIENT = 0x76011d0Dc2ca7AdAE7f0C408c872040Bc16437D1;

    // Designated wallet that funds and distributes MON rewards
    address public constant REWARD_SENDER = 0x76011d0Dc2ca7AdAE7f0C408c872040Bc16437D1;

    struct Pet {
        string name;
        uint8 hunger;
        uint8 hygiene;
        uint8 energy;
        uint16 level;
        uint256 xp;
        uint256 createdAt;
        uint256 lastUpdated;
        uint8 skinId;
    }

    struct LeaderboardEntry {
        address owner;
        string petName;
        uint16 level;
        uint256 xp;
        uint8 skinId;
    }

    mapping(address => Pet) public pets;
    mapping(address => bool) public hasPet;
    mapping(address => uint16) public lastClaimedLevel;
    
    uint256 public constant REWARD_PER_LEVEL = 0.005 ether;
    
    // Top 10 pets on-chain leaderboard, sorted by level desc, then xp desc.
    LeaderboardEntry[10] public leaderboard;

    // Events
    event PetCreated(address indexed owner, string name, uint8 skinId, uint256 timestamp);
    event Fed(address indexed owner, uint8 hunger, uint256 xp, uint16 level, uint256 timestamp);
    event Cleaned(address indexed owner, uint8 hygiene, uint256 xp, uint16 level, uint256 timestamp);
    event Slept(address indexed owner, uint8 energy, uint256 xp, uint16 level, uint256 timestamp);
    event Played(address indexed owner, uint8 energy, uint8 hunger, uint8 hygiene, uint256 xp, uint16 level, uint256 timestamp);
    event LeveledUp(address indexed owner, uint16 newLevel, uint256 timestamp);
    event LeaderboardUpdated(uint256 timestamp);
    event RewardClaimed(address indexed player, uint256 amount, uint16 upToLevel, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier hasActivePet() {
        require(hasPet[msg.sender], "You must create a pet first");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Creates a new pet for the sender.
     * @param _name Name of the pet (max 20 characters).
     * @param _skinId Skin type selection (0 = Chog, 1 = Molandak, 2 = Moyaki).
     */
    function createPet(string calldata _name, uint8 _skinId) external {
        require(!hasPet[msg.sender], "Pet already exists for this wallet");
        require(bytes(_name).length > 0 && bytes(_name).length <= 20, "Name must be between 1 and 20 chars");
        require(_skinId < 3, "Invalid skin ID");

        pets[msg.sender] = Pet({
            name: _name,
            hunger: 80,
            hygiene: 80,
            energy: 80,
            level: 1,
            xp: 0,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            skinId: _skinId
        });

        hasPet[msg.sender] = true;
        lastClaimedLevel[msg.sender] = 1;
        totalPets++;

        emit PetCreated(msg.sender, _name, _skinId, block.timestamp);
        
        _updateLeaderboard(msg.sender);
    }

    /**
     * @dev Cho ăn. Tăng đói (+20), nhận +5 XP.
     */
    function feedPet() external payable hasActivePet {
        require(msg.value == ACTION_FEE, "Must send exactly 0.01 MON");

        // Forward MON fee to the designated wallet
        (bool success, ) = payable(FEE_RECIPIENT).call{value: msg.value}("");
        require(success, "Fee transfer failed");

        Pet memory pet = _applyDecay(pets[msg.sender]);
        
        // Increase hunger by 20 (max 100)
        uint256 newHunger = pet.hunger + 20;
        pet.hunger = newHunger > 100 ? 100 : uint8(newHunger);
        
        pet.xp += 5;
        pet = _checkLevelUp(pet);
        pet.lastUpdated = block.timestamp;
        
        pets[msg.sender] = pet;
        
        emit Fed(msg.sender, pet.hunger, pet.xp, pet.level, block.timestamp);
        
        _updateLeaderboard(msg.sender);
    }

    /**
     * @dev Tắm rửa. Tăng vệ sinh (+20), nhận +5 XP.
     */
    function cleanPet() external payable hasActivePet {
        require(msg.value == ACTION_FEE, "Must send exactly 0.01 MON");

        // Forward MON fee to the designated wallet
        (bool success, ) = payable(FEE_RECIPIENT).call{value: msg.value}("");
        require(success, "Fee transfer failed");

        Pet memory pet = _applyDecay(pets[msg.sender]);
        
        // Increase hygiene by 20 (max 100)
        uint256 newHygiene = pet.hygiene + 20;
        pet.hygiene = newHygiene > 100 ? 100 : uint8(newHygiene);
        
        pet.xp += 5;
        pet = _checkLevelUp(pet);
        pet.lastUpdated = block.timestamp;
        
        pets[msg.sender] = pet;
        
        emit Cleaned(msg.sender, pet.hygiene, pet.xp, pet.level, block.timestamp);
        
        _updateLeaderboard(msg.sender);
    }

    /**
     * @dev Đi ngủ. Tăng thể lực (+30), nhận +3 XP.
     */
    function sleepPet() external payable hasActivePet {
        require(msg.value == ACTION_FEE, "Must send exactly 0.01 MON");

        // Forward MON fee to the designated wallet
        (bool success, ) = payable(FEE_RECIPIENT).call{value: msg.value}("");
        require(success, "Fee transfer failed");

        Pet memory pet = _applyDecay(pets[msg.sender]);
        
        // Increase energy by 30 (max 100)
        uint256 newEnergy = pet.energy + 30;
        pet.energy = newEnergy > 100 ? 100 : uint8(newEnergy);
        
        pet.xp += 3;
        pet = _checkLevelUp(pet);
        pet.lastUpdated = block.timestamp;
        
        pets[msg.sender] = pet;
        
        emit Slept(msg.sender, pet.energy, pet.xp, pet.level, block.timestamp);
        
        _updateLeaderboard(msg.sender);
    }

    /**
     * @dev Vui chơi. Giảm thể lực (-10), nhận +10 XP.
     * Ngẫu nhiên giảm đói hoặc vệ sinh (-10).
     */
    function playWithPet() external payable hasActivePet {
        require(msg.value == ACTION_FEE, "Must send exactly 0.01 MON");

        // Forward MON fee to the designated wallet
        (bool success, ) = payable(FEE_RECIPIENT).call{value: msg.value}("");
        require(success, "Fee transfer failed");

        Pet memory pet = _applyDecay(pets[msg.sender]);
        require(pet.energy >= 10, "Pet is too tired to play");

        pet.energy -= 10;
        pet.xp += 10;
        
        // Randomly decrease hunger or hygiene by 10
        uint256 randVal = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % 2;
        if (randVal == 0) {
            pet.hunger = pet.hunger >= 10 ? pet.hunger - 10 : 0;
        } else {
            pet.hygiene = pet.hygiene >= 10 ? pet.hygiene - 10 : 0;
        }

        pet = _checkLevelUp(pet);
        pet.lastUpdated = block.timestamp;
        
        pets[msg.sender] = pet;
        
        emit Played(msg.sender, pet.energy, pet.hunger, pet.hygiene, pet.xp, pet.level, block.timestamp);
        
        _updateLeaderboard(msg.sender);
    }

    /**
     * @dev Fetch pet stats with dynamic decay applied (View only).
     */
    function getPetStats(address _owner) external view returns (Pet memory) {
        require(hasPet[_owner], "No pet exists for this address");
        return _applyDecay(pets[_owner]);
    }

    /**
     * @dev Returns the full leaderboard array.
     */
    function getLeaderboard() external view returns (LeaderboardEntry[10] memory) {
        return leaderboard;
    }

    /**
     * @dev Allows the owner to withdraw the contract balance (fallback).
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Cho phép nạp tiền trực tiếp vào hợp đồng để làm quỹ thưởng.
     */
    receive() external payable {}

    /**
     * @dev Cho phép người chơi nhận thưởng MON khi tăng cấp.
     */
    function claimLevelReward() external hasActivePet {
        Pet memory pet = _applyDecay(pets[msg.sender]);
        uint16 currentLevel = pet.level;
        uint16 lastClaimed = lastClaimedLevel[msg.sender];
        
        require(currentLevel > lastClaimed, "No rewards to claim");
        
        uint256 claimableLevels = currentLevel - lastClaimed;
        uint256 rewardAmount = claimableLevels * REWARD_PER_LEVEL;
        
        require(address(this).balance >= rewardAmount, "Reward pool is empty");
        
        lastClaimedLevel[msg.sender] = currentLevel;
        
        (bool success, ) = payable(msg.sender).call{value: rewardAmount}("");
        require(success, "Reward payout failed");
        
        emit RewardClaimed(msg.sender, rewardAmount, currentLevel, block.timestamp);
    }

    /**
     * @dev Internal helper to apply stat decay over time.
     */
    function _applyDecay(Pet memory pet) internal view returns (Pet memory) {
        if (pet.lastUpdated == 0) return pet;
        uint256 timePassed = block.timestamp - pet.lastUpdated;
        if (timePassed == 0) return pet;

        // Hunger decay: 1 point per 1 hour (3600 seconds)
        uint256 hungerDecay = timePassed / 3600;
        if (hungerDecay > 0) {
            pet.hunger = pet.hunger > hungerDecay ? uint8(pet.hunger - hungerDecay) : 0;
        }

        // Hygiene decay: 1 point per 1.5 hours (5400 seconds)
        uint256 hygieneDecay = timePassed / 5400;
        if (hygieneDecay > 0) {
            pet.hygiene = pet.hygiene > hygieneDecay ? uint8(pet.hygiene - hygieneDecay) : 0;
        }

        // Energy decay: 1 point per 2 hours (7200 seconds)
        uint256 energyDecay = timePassed / 7200;
        if (energyDecay > 0) {
            pet.energy = pet.energy > energyDecay ? uint8(pet.energy - energyDecay) : 0;
        }

        return pet;
    }

    /**
     * @dev Internal helper to handle level up calculations.
     */
    function _checkLevelUp(Pet memory pet) internal returns (Pet memory) {
        uint256 xpNeeded = pet.level * 100;
        while (pet.xp >= xpNeeded) {
            pet.xp -= xpNeeded;
            pet.level += 1;
            xpNeeded = pet.level * 100;
            emit LeveledUp(msg.sender, pet.level, block.timestamp);
        }
        return pet;
    }

    /**
     * @dev Internal helper to update leaderboard standings.
     */
    function _updateLeaderboard(address _owner) internal {
        Pet memory pet = pets[_owner];
        
        // 1. Check if owner already exists on the leaderboard
        int8 existingIndex = -1;
        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].owner == _owner) {
                existingIndex = int8(i);
                break;
            }
        }
        
        // 2. If exists, update stats. If not, check if it qualifies to enter.
        if (existingIndex >= 0) {
            leaderboard[uint8(existingIndex)].level = pet.level;
            leaderboard[uint8(existingIndex)].xp = pet.xp;
            leaderboard[uint8(existingIndex)].petName = pet.name;
        } else {
            // Check if it qualifies to beat the 10th spot (index 9)
            if (leaderboard[9].owner == address(0) || 
                pet.level > leaderboard[9].level || 
                (pet.level == leaderboard[9].level && pet.xp > leaderboard[9].xp)) {
                
                leaderboard[9] = LeaderboardEntry({
                    owner: _owner,
                    petName: pet.name,
                    level: pet.level,
                    xp: pet.xp,
                    skinId: pet.skinId
                });
            } else {
                // Does not qualify for leaderboard
                return;
            }
        }
        
        // 3. Sort the leaderboard (Level desc, then XP desc)
        for (uint8 i = 0; i < 10; i++) {
            for (uint8 j = i + 1; j < 10; j++) {
                bool swapNeeded = false;
                if (leaderboard[j].owner != address(0)) {
                    if (leaderboard[i].owner == address(0)) {
                        swapNeeded = true;
                    } else if (leaderboard[j].level > leaderboard[i].level) {
                        swapNeeded = true;
                    } else if (leaderboard[j].level == leaderboard[i].level && leaderboard[j].xp > leaderboard[i].xp) {
                        swapNeeded = true;
                    }
                }
                if (swapNeeded) {
                    LeaderboardEntry memory temp = leaderboard[i];
                    leaderboard[i] = leaderboard[j];
                    leaderboard[j] = temp;
                }
            }
        }

        emit LeaderboardUpdated(block.timestamp);
    }
}
