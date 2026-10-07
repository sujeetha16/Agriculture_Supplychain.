// Path: blockchain/contracts/AgriChain.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgriChain {
    enum Role {
        None,
        Farmer,
        Distributor,
        Retailer,
        Consumer
    }

    enum Status {
        Created,
        DispatchedToDistributor,
        ReceivedByDistributor,
        DispatchedToRetailer,
        ReceivedByRetailer,
        SoldToConsumer
    }

    struct Product {
        uint256 id;
        string name;
        string harvestDate;
        address farmer;
        address distributor;
        address retailer;
        address consumer;
        string dispatchToDistributorDate;
        string distributorReceiveDate;
        string dispatchToRetailerDate;
        string retailerReceiveDate;
        string soldToConsumerDate;
        Status status;
        bool exists;
    }

    uint256 private nextProductId = 1;
    mapping(address => Role) public roles;
    mapping(uint256 => Product) private products;

    event RoleRegistered(address indexed account, Role role);
    event ProductCreated(
        uint256 indexed productId,
        string name,
        string harvestDate,
        address indexed farmer,
        uint256 timestamp
    );
    event ProductDispatchedToDistributor(
        uint256 indexed productId,
        address indexed farmer,
        address indexed distributor,
        string date,
        uint256 timestamp
    );
    event ProductReceivedByDistributor(
        uint256 indexed productId,
        address indexed distributor,
        string date,
        uint256 timestamp
    );
    event ProductDispatchedToRetailer(
        uint256 indexed productId,
        address indexed distributor,
        address indexed retailer,
        string date,
        uint256 timestamp
    );
    event ProductReceivedByRetailer(
        uint256 indexed productId,
        address indexed retailer,
        string date,
        uint256 timestamp
    );
    event ProductSoldToConsumer(
        uint256 indexed productId,
        address indexed retailer,
        address indexed consumer,
        string date,
        uint256 timestamp
    );

    modifier onlyRole(Role requiredRole) {
        require(roles[msg.sender] == requiredRole, "Caller does not have required role");
        _;
    }

    modifier productExists(uint256 productId) {
        require(products[productId].exists, "Product does not exist");
        _;
    }

    function registerRole(Role role) external {
        require(role != Role.None, "Invalid role");
        require(roles[msg.sender] == Role.None, "Role already registered");
        roles[msg.sender] = role;
        emit RoleRegistered(msg.sender, role);
    }

    function getRole(address account) external view returns (Role) {
        return roles[account];
    }

    function createProduct(
        string calldata name,
        string calldata harvestDate
    ) external onlyRole(Role.Farmer) returns (uint256 productId) {
        require(bytes(name).length > 0, "Product name is required");
        require(bytes(harvestDate).length > 0, "Harvest date is required");

        productId = nextProductId++;
        products[productId] = Product({
            id: productId,
            name: name,
            harvestDate: harvestDate,
            farmer: msg.sender,
            distributor: address(0),
            retailer: address(0),
            consumer: address(0),
            dispatchToDistributorDate: "",
            distributorReceiveDate: "",
            dispatchToRetailerDate: "",
            retailerReceiveDate: "",
            soldToConsumerDate: "",
            status: Status.Created,
            exists: true
        });

        emit ProductCreated(productId, name, harvestDate, msg.sender, block.timestamp);
    }

    function dispatchToDistributor(
        uint256 productId,
        address distributor,
        string calldata date
    ) external onlyRole(Role.Farmer) productExists(productId) {
        Product storage p = products[productId];
        require(p.farmer == msg.sender, "Only product farmer can dispatch");
        require(roles[distributor] == Role.Distributor, "Receiver is not a distributor");
        require(p.status == Status.Created, "Invalid product status");
        require(bytes(date).length > 0, "Date is required");

        p.distributor = distributor;
        p.dispatchToDistributorDate = date;
        p.status = Status.DispatchedToDistributor;

        emit ProductDispatchedToDistributor(productId, msg.sender, distributor, date, block.timestamp);
    }

    function receiveFromFarmer(
        uint256 productId,
        string calldata date
    ) external onlyRole(Role.Distributor) productExists(productId) {
        Product storage p = products[productId];
        require(p.distributor == msg.sender, "Only assigned distributor can receive");
        require(p.status == Status.DispatchedToDistributor, "Invalid product status");
        require(bytes(date).length > 0, "Date is required");

        p.distributorReceiveDate = date;
        p.status = Status.ReceivedByDistributor;

        emit ProductReceivedByDistributor(productId, msg.sender, date, block.timestamp);
    }

    function dispatchToRetailer(
        uint256 productId,
        address retailer,
        string calldata date
    ) external onlyRole(Role.Distributor) productExists(productId) {
        Product storage p = products[productId];
        require(p.distributor == msg.sender, "Only assigned distributor can dispatch");
        require(roles[retailer] == Role.Retailer, "Receiver is not a retailer");
        require(p.status == Status.ReceivedByDistributor, "Invalid product status");
        require(bytes(date).length > 0, "Date is required");

        p.retailer = retailer;
        p.dispatchToRetailerDate = date;
        p.status = Status.DispatchedToRetailer;

        emit ProductDispatchedToRetailer(productId, msg.sender, retailer, date, block.timestamp);
    }

    function receiveFromDistributor(
        uint256 productId,
        string calldata date
    ) external onlyRole(Role.Retailer) productExists(productId) {
        Product storage p = products[productId];
        require(p.retailer == msg.sender, "Only assigned retailer can receive");
        require(p.status == Status.DispatchedToRetailer, "Invalid product status");
        require(bytes(date).length > 0, "Date is required");

        p.retailerReceiveDate = date;
        p.status = Status.ReceivedByRetailer;

        emit ProductReceivedByRetailer(productId, msg.sender, date, block.timestamp);
    }

    function sellToConsumer(
        uint256 productId,
        address consumer,
        string calldata date
    ) external onlyRole(Role.Retailer) productExists(productId) {
        Product storage p = products[productId];
        require(p.retailer == msg.sender, "Only assigned retailer can sell");
        require(roles[consumer] == Role.Consumer, "Consumer wallet must be registered");
        require(p.status == Status.ReceivedByRetailer, "Invalid product status");
        require(bytes(date).length > 0, "Date is required");

        p.consumer = consumer;
        p.soldToConsumerDate = date;
        p.status = Status.SoldToConsumer;

        emit ProductSoldToConsumer(productId, msg.sender, consumer, date, block.timestamp);
    }

    function getProduct(uint256 productId)
        external
        view
        productExists(productId)
        returns (Product memory)
    {
        return products[productId];
    }

    function getNextProductId() external view returns (uint256) {
        return nextProductId;
    }
}
