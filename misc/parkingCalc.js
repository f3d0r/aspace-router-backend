const constants = require('@config');

module.exports = {
    searchApplicableParking: function (parkingSpots, minFeet) {
        var sortedBlockJSON = sortByBlockID(parkingSpots);
        var minAdjacency = getAdjacencyNumber(minFeet);
        return getMostAdjacent(sortedBlockJSON, minAdjacency);
    }
};

function getMostAdjacent(sortedBlockJSON, mostAdjacent) {
    var finalMatchingSpots = [];
    for (var currentBlock in sortedBlockJSON) {
        var currentAdjacencies = [];
        currentAdjacencies.push(sortedBlockJSON[currentBlock][0]);
        for (var index = 1; index < sortedBlockJSON[currentBlock].length; index++) {
            var currentSpot = sortedBlockJSON[currentBlock][index];
            if (currentAdjacencies[currentAdjacencies.length - 1].spot_id + 1 != currentSpot.spot_id) {
                matchingSpots = addCurrentStripIfQualifies(currentAdjacencies, mostAdjacent, finalMatchingSpots);
                currentAdjacencies = [];
            }
            currentAdjacencies.push(currentSpot);
        }
        matchingSpots = addCurrentStripIfQualifies(currentAdjacencies, mostAdjacent, finalMatchingSpots);
    }
    return finalMatchingSpots;
}

function addCurrentStripIfQualifies(currentAdjacencies, mostAdjacent, finalMatchingSpots) {
    if (currentAdjacencies.length >= mostAdjacent) {
        var lastIndex = 0;
        for (var index = 0; index < currentAdjacencies.length; index += mostAdjacent - 1) {
            if (index != 0)
                finalMatchingSpots.push(currentAdjacencies[Math.ceil((index + lastIndex) / 2)]);
            lastIndex = index;
        }
    }
    return finalMatchingSpots;
}

function sortByBlockID(rawList) {
    var unique = rawList.map(d => d.block_id).filter(onlyUnique);
    var rawJSON = {};

    unique.forEach(function (entry) {
        rawJSON[entry] = [];
    });

    for (var index = 0; index < rawList.length; index++) {
        if (rawList[index].occupied == 'F')
            rawJSON[rawList[index].block_id].push(rawList[index]);
    }
    sortedJSON = JSON.parse(JSON.stringify(rawJSON));

    return sortedJSON;
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function getAdjacencyNumber(minFeet) {
    return Math.ceil(minFeet / constants.sensors.sensorDeltaFeet) + 1;
}