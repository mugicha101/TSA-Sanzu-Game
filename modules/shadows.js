import * as ce from './canvasExtension.js';
import {MainLoop, Draw, zoom} from './main.js';
import {MapObject, BVH} from './mapObj.js';
import {Player} from "./player.js"
import * as inp from './input.js';
import {Enemy} from "./enemy.js";
const c = ce.c;
const shadowOpacity = 0.5;
const canvas = ce.canvas;
export {sCanvas, sCtx, drawShadows, ShadowObject, ShadowBox, ShadowCircle, shadowOpacity}

const sCanvas = ce.createCanvas(ce.screenDim[0], ce.screenDim[1]);
const sCtx = sCanvas.getContext("2d");

class Anchor {
    constructor(x, y) {
        this.pos = [x,y];
    }
}

class ShadowObject {
    static objDict = {};
    static activeId = 0;
    constructor(x, y) {
        this.pos = [x,y];
        this.id = ShadowObject.activeId;
        this.enabled = true;
        ShadowObject.objDict[this.id] = this;
        ShadowObject.activeId++;
    }

    remove() {
        delete ShadowObject.objDict[this.id];
    }

    unindex() { // here for consistency sake
        delete ShadowObject.objDict[this.id];
    }
    reindex() {
        ShadowObject.objDict[this.id] = this;
    }
}

class ShadowBox extends ShadowObject {
    constructor(x, y, width, height) {
        super(x, y);
        this.dim = [width, height]
        this.type = "box";
    }
    getAnchors() {
        return [
            new Anchor(this.pos[0], this.pos[1]), new Anchor(this.pos[0]+this.dim[0], this.pos[1]), new Anchor(this.pos[0], this.pos[1]+this.dim[1]), new Anchor(this.pos[0]+this.dim[0], this.pos[1]+this.dim[1])
        ];
    }
}

class ShadowCircle extends ShadowObject {
    constructor(x, y, radius) {
        super(x, y);
        this.radius = radius
        this.type = "circle";
    }
}

function clearShadowCanvas() {
    // clear canvas
    sCtx.resetTrans();
    sCtx.clearRect(0,0,ce.screenDim[0],ce.screenDim[1])
}

function drawShadows(vignette=true, flashlight=false) {
    const flashlightRange = 45;
    clearShadowCanvas();

    //sCtx.transformCanvas(1, 0, ce.screenDim[0]/2 - Player.camPos[0], ce.screenDim[1]/2 + Player.camPos[1]);
    Draw.camCanvasOffset(sCtx);
    c.font = "30px Arial";
    c.textAlign = "left";
    sCtx.fillStyle = "rgb(0,0,0)";

    // vignette
    if (vignette) {
        let grd = sCtx.createRadialGradient(ce.screenDim[0]/2, ce.screenDim[1]/2, 0, ce.screenDim[0]/2, ce.screenDim[1]/2, Math.sqrt(ce.screenDim[0] ** 2 + ce.screenDim[1] ** 2)/2);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(0.7, "rgba(0,0,0,0.5)");
        grd.addColorStop(1, "rgba(0,0,0,1)");
        sCtx.save();
        sCtx.resetTrans();
        sCtx.fillStyle = grd;
        sCtx.fillRect(0,0,ce.screenDim[0],ce.screenDim[1]);
        sCtx.restore();
    }

    // flashlight effect
    if (flashlight) {
        sCtx.globalCompositeOperation = "destination-out";
        let basePos = [];
        for (let i = 0; i < 2; i++) {
            basePos[i] = Player.pos[i];
        }
        let posList = [
            ce.move(basePos, Player.dir+flashlightRange/2, 1),
            ce.move(basePos, Player.dir-flashlightRange/2, 1)
        ];
        let shadowAnchorList = [];
        posList.forEach(function(pos) {
            let ep = edgePoints(pos);
            shadowAnchorList.push({sa: new Anchor(pos[0], pos[1]), edgeCoords: ep.edgeCoords, edge: ep.edge});
        })
        createShadow(shadowAnchorList)
        sCtx.globalCompositeOperation = "source-over";
    }

    /*
    for (let index1 in ShadowObject.objDict) {
        let obj = ShadowObject.objDict[index1]
        if (!obj.enabled) continue;
        let shadowAnchorList = [];
        if (obj.type === "box") {
            shadowAnchorList = boxShadow(obj, index1);
            sCtx.fillRect(obj.pos[0], -obj.pos[1]-obj.dim[1], obj.dim[0], obj.dim[1]);
            createShadow(shadowAnchorList);
        }
        else if (obj.type === "circle") {
            shadowAnchorList = circleShadow(obj, index1);
            sCtx.fillCircle(obj.pos[0], -obj.pos[1], obj.radius);
            createShadow(shadowAnchorList);
        };
    }
    */

    // draw mapobject shadows
    let canidates = BVH.getColCanidates(Draw.camHB);
    for (let id in Enemy.eDict) {
        let e = Enemy.eDict[id];
        canidates.push(Enemy.eDict[id]);
    }
    for (let i = 0; i < canidates.length; i++) {
        let mo = canidates[i];
        for (let j = 0; j < mo.colArr.length; j++) {
            let obj = mo.colArr[j].shadowObj;
            if (obj == null) continue;
            if (!obj.enabled) continue;
            let shadowAnchorList = [];
            if (obj.type === "box") {
                shadowAnchorList = boxShadow(obj, obj.id);
                sCtx.fillRect(obj.pos[0], -obj.pos[1]-obj.dim[1], obj.dim[0], obj.dim[1]);
                createShadow(shadowAnchorList);
            }
            else if (obj.type === "circle") {
                shadowAnchorList = circleShadow(obj, obj.id);
                sCtx.fillCircle(obj.pos[0], -obj.pos[1], obj.radius);
                createShadow(shadowAnchorList);
            };
        }
    }

    // draw shadow canvas on main canvas
    c.resetTrans();
    c.globalAlpha = shadowOpacity;
    c.drawImage(sCanvas, 0, 0);
    c.globalAlpha = 1;
}

function boxShadow(box, index1) {
    // test to see if no anchors onscreen
    let anchors = box.getAnchors();
    let all_offscreen = true;
    anchors.forEach(function(anchor, index2) {
        if (Math.abs(anchor.pos[0] - Player.camPos[0]) < ce.screenDim[0]/2/zoom && Math.abs(anchor.pos[1] - Player.camPos[1]) < ce.screenDim[1]/2/zoom) {
            all_offscreen = false;
            return;
        }
    })
    if (all_offscreen) return [];
    let shadowAnchorList = []
    anchors.forEach(function(anchor, index2) {
        // Get y/x line data
        let dx = anchor.pos[0] - Player.pos[0]
        let dy = anchor.pos[1] - Player.pos[1]
        let slope1 = (dx === 0)? null : dy/dx;
        let yint = (dx === 0)? null : Player.pos[1] - Player.pos[0]*slope1;

        // get x/y line data
        let slope2 = (dy === 0)? null : dx/dy;
        let xint = (dy === 0)? null : Player.pos[0] - Player.pos[1]*slope2;

        // detect if intersecting box
        let has_intersect = false;
        let cy;
        let cx;

        if (slope1 == null) {
            if (Player.pos[1] <= anchor.pos[1] && (index2 === 0 || index2 === 1)) {
                has_intersect = true;
            }
            if (Player.pos[1] >= anchor.pos[1] && (index2 === 2 || index2 === 3)) {
                has_intersect = true;
            }
        } else if (slope1 == 0) {
            if (Player.pos[0] <= anchor.pos[0] && (index2 === 0 || index2 === 2)) {
                has_intersect = true;
            }
            if (Player.pos[0] >= anchor.pos[0] && (index2 === 1 || index2 === 3)) {
                has_intersect = true;
            }
        } else {
            // left bounds
            cy = yint + box.pos[0]*slope1;
            if (index2 != 0 && index2 != 2 && cy >= box.pos[1] && cy <= box.pos[1]+box.dim[1]) {
                has_intersect = true;
            }

            // right bounds
            cy = yint + (box.pos[0]+box.dim[0])*slope1;
            if (index2 != 1 && index2 != 3 && cy >= box.pos[1] && cy <= box.pos[1]+box.dim[1]) {
                has_intersect = true;
            }
        }

        if (slope2 == null) {
            if (Player.pos[0] <= anchor.pos[0] && (index2 === 0 || index2 === 2)) {
                has_intersect = true;
            }
            if (Player.pos[0] >= anchor.pos[0] && (index2 === 1 || index2 === 3)) {
                has_intersect = true;
            }
        } else if (slope2 == 0) {
            if (Player.pos[1] <= anchor.pos[1] && (index2 === 0 || index2 === 1)) {
                has_intersect = true;
            }
            if (Player.pos[1] >= anchor.pos[1] && (index2 === 2 || index2 === 3)) {
                has_intersect = true;
            }
        } else {
            // bottom bounds
            cx = xint + box.pos[1]*slope2;
            if (index2 != 0 && index2 != 1 && cx >= box.pos[0] && cx <= box.pos[0]+box.dim[0]) {
                has_intersect = true;
            }

            // top bounds
            cx = xint + (box.pos[1]+box.dim[1])*slope2;
            if (index2 != 2 && index2 != 3 && cx >= box.pos[0] && cx <= box.pos[0]+box.dim[0]) {
                has_intersect = true;
            }
        }

        if (!has_intersect) {
            // calculate where on the edge of the screen the line collides
            let ep = edgePoints(anchor.pos);

            // add to shadowAnchorList
            shadowAnchorList.push({id: index2, sa: anchors[index2], edgeCoords: ep.edgeCoords, edge: ep.edge});
        }
    })
    return shadowAnchorList;
}

function circleShadow(cir, index1) {
    let shadowAnchorList = []

    // test if player in circle
    if (Math.sqrt((Player.pos[0] - cir.pos[0]) ** 2 + (Player.pos[1] - cir.pos[1]) ** 2) <= cir.radius) return [];

    // test if off screen
    for (let i = 0; i < 2; i++) {
        if (Math.abs(cir.pos[i] - Player.camPos[i]) > ce.screenDim[i]/2/zoom + cir.radius) return [];
    }

    // calculate points (find tangential points)
    let x = Player.pos[0] - cir.pos[0];
    let y = Player.pos[1] - cir.pos[1];
    let altY = false;
    if (y === 0) {
        altY = true;
        y += 1
    }
    let r = cir.radius;
    let discroot = Math.sqrt(4 * r ** 4 * x ** 2 - 4 * (y ** 2 + x ** 2) * (r ** 4 - r ** 2 * y ** 2));
    let midval = 2 * r ** 2 * x;
    let div = 2 * y ** 2 + 2 * x ** 2;
    let a1 = (midval + discroot) / div;
    let a2 = (midval - discroot) / div;
    let b1 = (r ** 2 - a1 * x) / y;
    let b2 = (r ** 2 - a2 * x) / y;

    let anchors = [new Anchor(a1 + cir.pos[0], b1 + cir.pos[1] - ((altY) ? 1 : 0)), new Anchor(a2 + cir.pos[0], b2 + cir.pos[1] - ((altY) ? 1 : 0))];
    anchors.forEach(function(anchor, index2) {
        let ep = edgePoints(anchor.pos);

        // add to shadowAnchorList
        shadowAnchorList.push({id: index2, sa: anchors[index2], edgeCoords: ep.edgeCoords, edge: ep.edge});
    })

    return shadowAnchorList;
}

function edgePoints(pos) {
    // Get y/x line data
    let dx = pos[0] - Player.pos[0]
    let dy = pos[1] - Player.pos[1]
    let slope1 = (dx === 0)? null : dy/dx;
    let yint = (dx === 0)? null : Player.pos[1] - Player.pos[0]*slope1;

    // get x/y line data
    let slope2 = (dy === 0)? null : dx/dy;
    let xint = (dy === 0)? null : Player.pos[0] - Player.pos[1]*slope2;

    // calculate where on the edge of the screen the line collides
    let edgeCoords = [0,0];
    let edge = "";
    let cx;
    let cy;
    if (slope1 == null) {
        if (Player.pos[1] < pos[1]) {
            edgeCoords = [pos[0], Player.camPos[1]+ce.screenDim[1]/2/zoom];
            edge = "t";
        } else {
            edgeCoords = [pos[0], Player.camPos[1]-ce.screenDim[1]/2/zoom];
            edge = "b";
        }
    } else if (slope2 == null) {
        if (Player.pos[0] < pos[0]) {
            edgeCoords = [Player.camPos[0]+ce.screenDim[0]/2/zoom, pos[1]];
            edge = "r";
        } else {
            edgeCoords = [Player.camPos[0]-ce.screenDim[0]/2/zoom, pos[1]];
            edge = "l";
        }
    } else {
        // top of screen
        cy = Player.camPos[1]+ce.screenDim[1]/2/zoom
        cx = xint + cy*slope2
        if (Player.pos[1] <= pos[1] && cx-Player.camPos[0] <= ce.screenDim[0]/2/zoom && cx-Player.camPos[0] >= -ce.screenDim[0]/2/zoom) {
            edgeCoords = [cx, cy];
            edge = "t";
        }

        // bottom of screen
        cy = Player.camPos[1]-ce.screenDim[1]/2/zoom
        cx = xint + cy*slope2
        if (Player.pos[1] >= pos[1] && cx-Player.camPos[0] <= ce.screenDim[0]/2/zoom && cx-Player.camPos[0] >= -ce.screenDim[0]/2/zoom) {
            edgeCoords = [cx, cy];
            edge = "b";
        }

        // right of screen
        cx = Player.camPos[0]+ce.screenDim[0]/2/zoom
        cy = yint + cx*slope1
        if (Player.pos[0] <= pos[0] && cy-Player.camPos[1] <= ce.screenDim[1]/2/zoom && cy-Player.camPos[1] >= -ce.screenDim[1]/2/zoom) {
            edgeCoords = [cx, cy];
            edge = "r";
        }

        // left of screen
        cx = Player.camPos[0]-ce.screenDim[0]/2/zoom
        cy = yint + cx*slope1
        if (Player.pos[0] >= pos[0] && cy-Player.camPos[1] <= ce.screenDim[1]/2/zoom && cy-Player.camPos[1] >= -ce.screenDim[1]/2/zoom) {
            edgeCoords = [cx, cy];
            edge = "l";
        }
    }
    return {edge: edge, edgeCoords: edgeCoords};
}

function createShadow(shadowAnchorList) {
    // draw shadow
    if (shadowAnchorList.length >= 2) {
        // get shadow points
        let shadowPoints = [];
        let edges = "";
        for (let i = 0; i < 2; i++) {
            let sa = shadowAnchorList[i].sa;
            edges += shadowAnchorList[i].edge;
            let edgeCoords = shadowAnchorList[i].edgeCoords;
            if (i === 0) {
                shadowPoints.push(sa.pos, edgeCoords)
            } else {
                shadowPoints.push(edgeCoords, sa.pos)
            }
        }
        shadowPoints.push(shadowPoints[0])

        // add corner point if necessary
        const top = [Player.camPos[1]+ce.screenDim[1]/2/zoom];
        const bottom = [Player.camPos[1]-ce.screenDim[1]/2/zoom];
        const right = [Player.camPos[0]+ce.screenDim[0]/2/zoom];
        const left = [Player.camPos[0]-ce.screenDim[0]/2/zoom];
        if (edges === "tr" || edges === "rt") {
            shadowPoints.splice(2, 0, [right, top])
        }
        if (edges === "tl" || edges === "lt") {
            shadowPoints.splice(2, 0, [left, top])
        }
        if (edges === "br" || edges === "rb") {
            shadowPoints.splice(2, 0, [right, bottom])
        }
        if (edges === "bl" || edges === "lb") {
            shadowPoints.splice(2, 0, [left, bottom])
        }
        if (edges === "bt") {
            if ((shadowPoints[1][0] + shadowPoints[2][0])/2 > Player.pos[0]) {
                shadowPoints.splice(2, 0, [right, top])
                shadowPoints.splice(2, 0, [right, bottom])
            } else {
                shadowPoints.splice(2, 0, [left, top])
                shadowPoints.splice(2, 0, [left, bottom])
            }
        }
        if (edges === "tb") {
            if ((shadowPoints[1][0] + shadowPoints[2][0])/2 > Player.pos[0]) {
                shadowPoints.splice(2, 0, [right, bottom])
                shadowPoints.splice(2, 0, [right, top])
            } else {
                shadowPoints.splice(2, 0, [left, bottom])
                shadowPoints.splice(2, 0, [left, top])
            }
        }
        if (edges === "lr") {
            if ((shadowPoints[1][1] + shadowPoints[2][1])/2 > Player.pos[1]) {
                shadowPoints.splice(2, 0, [right, top])
                shadowPoints.splice(2, 0, [left, top])
            } else {
                shadowPoints.splice(2, 0, [right, bottom])
                shadowPoints.splice(2, 0, [left, bottom])
            }
        }
        if (edges === "rl") {
            if ((shadowPoints[1][1] + shadowPoints[2][1])/2 > Player.pos[1]) {
                shadowPoints.splice(2, 0, [left, top])
                shadowPoints.splice(2, 0, [right, top])
            } else {
                shadowPoints.splice(2, 0, [left, bottom])
                shadowPoints.splice(2, 0, [right, bottom])
            }
        }

        // draw shadow
        sCtx.beginPath()
        shadowPoints.forEach(function(p, index) {
            sCtx.lineTo(p[0], -p[1])
        })
        sCtx.fill()
    }
}