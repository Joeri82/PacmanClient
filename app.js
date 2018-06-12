const TYPE_PACMAN = 'PACMAN';
const TYPE_GHOSTS = 'GHOSTS';
const DIRECTION_NORTH = 'NORTH';
const DIRECTION_EAST = 'EAST';
const DIRECTION_SOUTH = 'SOUTH';
const DIRECTION_WEST = 'WEST';

const registerGame = () => {
    const request = new Request('http://localhost:8080/register-game');
    return fetch(request)
        .then(response => response.json())
        .then(json => json.gameId);
};

const registerPlayer = (gameId, type) => {
    const request = new Request('http://localhost:8080/register-player', {
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

const performMove = (gameId, authId, type, direction) => {
    const request = new Request('http://localhost:8080/perform-move', {
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

const getNextDot = currentState => {
    const pacmanPosition = currentState.pacman.currentPosition;
    const remainingDots = currentState.remainingDots;

    let closestDot = remainingDots[0];
    for (const dot of remainingDots) {
        if (Math.abs(dot.x - pacmanPosition.x) <= Math.abs(closestDot.x - pacmanPosition.x) &&
            Math.abs(dot.y - pacmanPosition.y) <= Math.abs(closestDot.y - pacmanPosition.y)) {
            closestDot = dot;
        }
    }

    return closestDot;
};

async function start() {
    const gameId = await registerGame();
    const pacman = await registerPlayer(gameId, TYPE_PACMAN);
    const ghosts = await registerPlayer(gameId, TYPE_GHOSTS);

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
    }
    registerWalls();

    let path, blinkPath, gridBackup, finder, finderBlinky, 
        directions, direction, directionBlinky, nextDot, directionsBlinky;
    
    fetchStreaming('http://localhost:8080/current-state', {
        body: JSON.stringify({
            gameId,
        }),
        headers: {
            'content-type': 'application/json'
        },
        method: 'POST'
    }, stream => {
        const currentState = JSON.parse(stream);
        console.log(currentState);
        
        //Path: Pacman
        if (!directions || directions.length === 0) {
            nextDot = getNextDot(currentState);
            gridBackup = grid.clone();
            finder = new PF.AStarFinder();
            path = finder.findPath(currentState.pacman.currentPosition.x, currentState.pacman.currentPosition.y, nextDot.x, nextDot.y, gridBackup);
            directions = translatePathToDirection(path);
            directions = directions.reverse();
            directions.pop();
        }
        
       
        if (directions.length !== 0) {
            direction = directions.pop();
            performMove(gameId, pacman.authId, TYPE_PACMAN, direction);
        }
        
        //Path: Blinky
        if (!directionBlinky || directionBlinky.length === 0) {
            finderBlinky = new PF.DijkstraFinder();
            blinkPath = finder.findPath(currentState.blinky.x, currentState.blinky.y, currentState.pacman.currentPosition.x, currentState.pacman.currentPosition.y, grid.clone());
            directionsBlinky = translatePathToDirection(blinkPath);
            directionsBlinky = directions.reverse();
            directionsBlinky.pop();
        }
        
        if(directionsBlinky.length !== 0) {
            directionBlinky = directionsBlinky.pop();
            performMove(gameId, pacman.authId, 'BLINKY', directionBlinky);
        }
    });
}
