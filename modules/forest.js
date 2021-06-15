import { Graphic, MapObject } from './mapObj.js'
import { HitBox, HitCircle, Collision } from './collisions.js'
export { spawnTree, spawnForest, spawnForestFromCanvas, spawnForestFromCollisions, treeArr }

let treeArr = [];
function spawnTree(pos, treeVariant = 0) {
    // return "TESTING"
    let t = new MapObject(pos, [
        new Graphic(`tree/${treeVariant}/trunk`, ["wall"], ".png", 0.5, 1, 1, [-768/4,-112*0.5]),
        new Graphic(`tree/${treeVariant}/leaves`, ["wall"], ".png", 0.5, 1, 1, [-768/4,-112*0.5])
    ], [new HitCircle([0,0], 112*0.5, true)], [-768/4, -112*0.5, 768*0.5-768/4, 1024*0.5-112*0.5]);
    treeArr.push(t);
    return t;
}

// spawns a forest
// if returnPosArr, returns positions of trees instead of spawning trees
function spawnForest(cornerA, cornerB, density=1, returnPosArr=false, treeVariant = 0) {
    // get bottom left corner and top left corner
    let bounds = [0,0,0,0];
    for (let n = 0; n < 2; n++) {
        if (cornerA[n] < cornerB[n]) {
            bounds[n] = cornerA[n];
            bounds[n+2] = cornerB[n];
        } else {
            bounds[n] = cornerB[n];
            bounds[n+2] = cornerA[n];
        }
    }

    // density of 1 means 1 tree per 150x150 area
    let forestDim = [bounds[2]-bounds[0], bounds[3]-bounds[1]];
    let area = forestDim[0]*forestDim[1]
    let trees = Math.round(area*density/150/150);
    let posArr = [];
    for (let i = 0; i < trees; i++) {
        let pos = [
            bounds[0] + Math.random() * forestDim[0],
            bounds[1] + Math.random() * forestDim[1]
        ];
        posArr.push(pos);
    }
    if (returnPosArr) return posArr;
    else {
        for (let i = 0; i < posArr.length; i++) {
            let pos = posArr[i];
            spawnTree(pos, treeVariant);
        }
    }
}

// spawn forest from canvas image
// chance of spawning is based on highest rgb value (0=0%, 255=100%)
function spawnForestFromCanvas(maskCanvas, density=1, offset=[0,0], scale=1, treeVariant = 0) {
    // spawn trees
    let posArr = spawnForest(offset, [offset[0]+maskCanvas.width*scale, offset[1]+maskCanvas.height*scale], density, true);
    let mCtx = maskCanvas.getContext('2d');
    let trees = 0;
    for (let i = 0; i < posArr.length; i++) {
        let pos = posArr[i];
        let mPos = [(pos[0]-offset[0])/scale, (pos[1]-offset[1])/scale];
        let pixelData = mCtx.getImageData(mPos[0], mPos[1], 1, 1).data;
        // get chance to spawn
        let spawnChance = pixelData[0];
        for (let j = 1; j < 3; j++) {
            if (pixelData[j] > spawnChance)
                spawnChance = pixelData[j];
        }
        spawnChance /= 255;
        if (Math.random() < spawnChance) {
            trees++;
            spawnTree(pos, treeVariant);
        }
    }
    console.log("trees:", trees)
}

// spawns forest in the boundaries of collision objects
function spawnForestFromCollisions(colArr, density=1, treeVariant = 0) {
    // get forest bounds
    if (colArr.length === 0) return;
    let forestBounds = [null, null, null, null];
    for (let i = 0; i < colArr.length; i++) {
        let col = colArr[i];
        // get collision bounds
        let colBounds = col.getBounds();

        // update forest bounds
        for (let j = 0; j < 2; j++) {
            if (forestBounds[j] == null || colBounds[j] < forestBounds[j])
                forestBounds[j] = colBounds[j];
            if (forestBounds[j+2] == null || colBounds[j+2] > forestBounds[j+2])
                forestBounds[j+2] = colBounds[j+2];
        }
    }
    
    // create a canvas with black on all the forest zones
    let maskCanvas = ce.createCanvas(forestBounds[2]-forestBounds[0], forestBounds[3]-forestBounds[1]);
    let mCtx = maskCanvas.getContext('2d');
    mCtx.fillStyle = "rgb(0,0,0)";
    mCtx.fillRect(0,0,maskCanvas.width, maskCanvas.height);
    let offset = [-forestBounds[0], -forestBounds[1]];
    mCtx.fillStyle = "rgb(255,0,0)";
    for (let i = 0; i < colArr.length; i++) {
        let col = colArr[i];
        if (col.type === "box") {
            mCtx.fillRect(col.pos[0]+offset[0], col.pos[1]+offset[1], col.dim[0], col.dim[1]);
        } else {
            mCtx.fillCircle(col.pos[0]+offset[0], col.pos[1]+offset[1], col.radius);
        }
    }

    // spawn trees
    spawnForestFromCanvas(maskCanvas, density, [forestBounds[0], forestBounds[1]], 1, treeVariant);
    return maskCanvas;
}