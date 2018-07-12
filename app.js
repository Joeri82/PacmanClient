const TYPE_PACMAN = 'PACMAN';
const TYPE_GHOSTS = 'GHOSTS';
const DIRECTION_NORTH = 'NORTH';
const DIRECTION_EAST = 'EAST';
const DIRECTION_SOUTH = 'SOUTH';
const DIRECTION_WEST = 'WEST';
const LOCALSERVER = 'localhost:8080';

const registerGame = (server) => {
    const loc = server || LOCALSERVER;
    const request = new Request(`http://${loc}/register-game`);
    return fetch(request)
        .then(response => response.json())
        .then(json => json.gameId);
};

const registerPlayer = (gameId, type, server) => {
    const loc = server || LOCALSERVER;
    const request = new Request(`http://${loc}/register-player`, {
        body: JSON.stringify({
            gameId,
            type
        }),
        headers: {
            'content-type': 'application/json'
        },
        method: 'POST'
    });
    return fetch(request)
        .then(response => response.json());
};

const performMove = (gameId, authId, type, direction, server) => {
    const loc = server || LOCALSERVER;
    const request = new Request(`http://${loc}/perform-move`, {
        body: JSON.stringify({
            gameId,
            authId,
            type,
            direction
        }),
        headers: {
            'content-type': 'application/json'
        },
        method: 'POST'
    });

    return fetch(request);
};

function translatePathToDirection(coordinates) {
    return coordinates.map(function (currentValue, index, array) {
        if (index > 0) {
            let prevX = array[index - 1][0];
            let prevY = array[index - 1][1];

            let currentX = currentValue[0];
            let currentY = currentValue[1];


            if (currentX > prevX) {
                return DIRECTION_EAST;
            } else if (currentX < prevX) {
                return DIRECTION_WEST
            }

            if (currentY > prevY) {
                return DIRECTION_SOUTH;
            } else if (currentY < prevY) {
                return DIRECTION_NORTH;
            }
        } else {
            return "";
        }
    })
}

const getNextClosestDotPath = (currentState, grid) => {
    const pacmanPosition = currentState.pacman.currentPosition;
    const remainingDots = currentState.remainingDots;
    const ghosts = ['blinky','pinky','inky','clyde'];
    let pacmansGrid = grid.clone();

    //ghost zone, 9 non walkable maze parts
    for(let ghost of ghosts) {
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x-1, currentState[ghost].currentPosition.y, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x-1, currentState[ghost].currentPosition.y-1, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x-1, currentState[ghost].currentPosition.y+1, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x+1, currentState[ghost].currentPosition.y, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x+1, currentState[ghost].currentPosition.y-1, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x+1, currentState[ghost].currentPosition.y+1, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x, currentState[ghost].currentPosition.y, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x, currentState[ghost].currentPosition.y-1, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x, currentState[ghost].currentPosition.y+1, false);
        pacmansGrid.setWalkableAt(currentState[ghost].currentPosition.x, currentState[ghost].currentPosition.y, false);
    }

    let closestPath = new Array(9999);

    for (let dot of remainingDots) {
        let finder = new PF.BiDijkstraFinder();
        let otherPath = finder.findPath(pacmanPosition.x, pacmanPosition.y, dot.x, dot.y, pacmansGrid.clone());
        if (otherPath.length > 0 && otherPath.length < closestPath.length) {
            closestPath = otherPath;
        }
    }

    return closestPath;
};

async function start(server) {
    const loc = server || LOCALSERVER;
    const gameId = await registerGame(server);
    const pacman = await registerPlayer(gameId, TYPE_PACMAN, server);
    const ghosts = await registerPlayer(gameId, TYPE_GHOSTS, server);

    const grid = new PF.Grid(19, 21);
    const registerWalls = () => {
        let x = 0;

        pacman.maze.walls.forEach((wall) => {
            let y = 0;
            wall.forEach((wallWalkable) => {
                grid.setWalkableAt(x, y, !wallWalkable);
                y++;
            });
            x++;
        });
    };
    registerWalls();

    let blinkPath, gridBackup, finder, finderBlinky,
        directions, direction, directionBlinky, nextDotPath, directionsBlinky;
    
    fetchStreaming(`http://${loc}/current-state`, {
        body: JSON.stringify({
            gameId,
        }),
        headers: {
            'content-type': 'application/json'
        },
        method: 'POST'
    }, stream => {
        const currentState = JSON.parse(stream);
        
        //Path: Pacman
        if (!directions || directions.length === 0) {
            directions = translatePathToDirection(getNextClosestDotPath(currentState, grid.clone()));
            directions = directions.reverse();
            directions.pop();
        }
        
       
        if (directions.length !== 0) {
            direction = directions.pop();
            performMove(gameId, pacman.authId, TYPE_PACMAN, direction);
        }
        
        //Path: Blinky
       /* if (!directionBlinky || directionBlinky.length === 0) {
            finderBlinky = new PF.DijkstraFinder();
            blinkPath = finderBlinky.findPath(currentState.blinky.x, currentState.blinky.y, currentState.pacman.currentPosition.x, currentState.pacman.currentPosition.y, grid.clone());
            directionsBlinky = translatePathToDirection(blinkPath);
            directionsBlinky = directions.reverse();
            directionsBlinky.pop();
        }
        
        if(directionsBlinky.length !== 0) {
            directionBlinky = directionsBlinky.pop();
            performMove(gameId, pacman.authId, 'BLINKY', directionBlinky);
        }*/
    });
}
