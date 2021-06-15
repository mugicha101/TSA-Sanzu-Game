import { MainLoop, Draw, zoom } from './main.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import * as ce from './canvasExtension.js';
import { Collision, HitBox, HitCircle } from './collisions.js';
export { MapObject, Graphic, BVH }

// an object that has a hitbox and graphics
class MapObject {
    static objDict = {}; // stores all loaded MapObject objects
    static unloadedObjDict = {}; // stores all unloaded MapObject objects
    static nextId = 0;
    // static utUpdate = true; // if true, runs mapobject.unloadtransfer asap (unloadtransfer replaced by BVH)
    pos = [0, 0];
    colArr = [];
    gArr = []; // list of all graphics
    id = '';
    #hidden = false;
    constructor(pos, gArr = [], colArr = [], aabb = null, alpha = 1, hidden = false) {
        this.id = MapObject.nextId;
        MapObject.nextId++;
        MapObject.objDict[this.id] = this;
        this.pos = pos;
        this.alpha = alpha;
        this.gArr = gArr;
        this.hidden = hidden;

        this.colArr = colArr;
        for (let i = 0; i < this.colArr.length; i++) {
            let col = this.colArr[i];
            col.basePos = [col.pos[0], col.pos[1]];
        }
        this.updateColPos();

        if (aabb != null) { // offset aabb relative to mo pos
            for (let i = 0; i < 4; i++) {
                aabb[i] += pos[i%2];
            }
        }
        this.aabb = (aabb == null)? this.getDefaultAabb() : aabb;
        
        /*
        AABB Quick Summary:
        - The bounds that will always contain the object
        - If object can move around, extend AABB to account for movement
        - If is still, is the most extreme x and ys of the object's collisions
        - If null, creates aabb using colArr
        - has 4 values: x1, y1, x2, y2
            - x1 and y1 are bottom left pos
            - x2 and y2 are top right pos
        */
    }

    getDefaultAabb() {
        // get aabb (used for optimization calculations)
        let aabb = [null,null,null,null]; // x1, y1, x2, y2. 1 is bottom left point, 2 is top right point
        for (let i = 0; i < this.colArr.length; i++) {
            let col = this.colArr[i];
            // get collision aabb
            let colBounds = col.getBounds();

            // update aabb
            for (let j = 0; j < 2; j++) {
                if (aabb[j] == null || colBounds[j] < aabb[j])
                    aabb[j] = colBounds[j];
                if (aabb[j+2] == null || colBounds[j+2] > aabb[j+2])
                    aabb[j+2] = colBounds[j+2];
            }
        }

        // check for null
        for (let i = 0; i < 4; i++) {
            if (aabb[i] == null) return [this.pos[0], this.pos[1], this.pos[0], this.pos[1]]
        }

        /*
        for (let i = 0; i < this.gArr.length; i++) {
            let g = this.gArr[i];
            // get graphic aabb
            let gPos = [this.pos[0]+g.offset[0],this.pos[1]+g.offset[1]];
            let img = g.getImage();
            if (!img.complete) continue;
            let gImgDim = [img.width*g.scale, img.height*g.scale]
            let gBounds = [
                gPos[0],
                gPos[1],
                gPos[0]+gImgDim[0],
                gPos[1]+gImgDim[1],
            ];
            // update aabb
            for (let j = 0; j < 2; j++) {
                if (aabb[j] == null || gBounds[j] < aabb[j])
                    aabb[j] = gBounds[j];
                if (aabb[j+2] == null || gBounds[j+2] > aabb[j+2])
                    aabb[j+2] = gBounds[j+2];
            }
        }
        */

        return aabb;
    }

    updateColPos() { // updates collision positions
        for (let i = 0; i < this.colArr.length; i++) {
            let item = this.colArr[i];
            for (let i = 0; i < 2; i++) {
                item.pos[i] = item.basePos[i] + this.pos[i];
            }
        }
    }

    moveAabb(xChange, yChange) {
        for (let i = 0; i < 4; i+=2) {
            this.aabb[i] += xChange;
            this.aabb[i+1] += yChange;
        }
    }

    // draws mapobject graphics
    // assumes already offset by camCoords
    draw(alphaMulti=1, ignoredLayers=[]) {
        let alpha = this.alpha * alphaMulti;
        if (this.hidden || alpha <= 0) return;
        for (let i = 0; i < this.gArr.length; i++) {
            this.gArr[i].draw(this.pos, alpha, ignoredLayers);
        }
    }

    // removes mapobject from static objdict
    remove() {
        for (let i = 0; i < this.colArr.length; i++) {
            this.colArr[i].unindex();
        }
        MapObject.unloadedObjDict[this.id] = this;
        delete MapObject.objDict[this.id];
    }


    // NOTE: UNLOAD TRANFER NOT CURRENTLY USED DUE TO BVH EFFECTIVENESS
    /*
    static unloadTransfer() { // unloads objects that are out of range
        // get loaded bounds
        /* Loaded Bounds:
            - On Screen
            - Around Player
           To Be Added:
            - Around All Enemies
            - Around All Bullets
        
        const bufferWidth = 1000;
        let loadedBounds = [];
        loadedBounds.push([ // screen bounds
            Player.camPos[0]-ce.screenDim[0]/zoom/2-bufferWidth,
            Player.camPos[1]-ce.screenDim[1]/zoom/2-bufferWidth,
            Player.camPos[0]+ce.screenDim[0]/zoom/2+bufferWidth,
            Player.camPos[1]+ce.screenDim[1]/zoom/2+bufferWidth, 
        ]);
        loadedBounds.push([ // player bounds (in case player off screen)
            Player.pos[0]-bufferWidth,
            Player.pos[1]-bufferWidth,
            Player.pos[0]+bufferWidth,
            Player.pos[1]+bufferWidth, 
        ]);
        let unloadIdArr = [];

        let inLoadedBounds = function(aabb) { // checks if aabb in loaded bounds
            for (let i = 0; i < loadedBounds.length; i++) {
                let bounds = loadedBounds[i];
                let inBounds = true;
                for (let j = 0; j < 2; j++) {
                    if (aabb[j+2] < bounds[j]) {
                        inBounds = false;
                        break;
                    }
                    if (aabb[j] > bounds[j+2]) {
                        inBounds = false;
                        break;
                    }
                }
                if (inBounds) return true;
            }
            return false;
        }

        // get loaded objects that need to be unloaded
        let nullBoundCount = 0;
        for (let id in MapObject.objDict) {
            let mo = MapObject.objDict[id];
            let aabb = mo.aabb;

            // check for null aabb
            let nullBounds = false;
            for (let j = 0; j < 4; j++) {
                if (aabb[j] == null) {
                    nullBounds = true;
                    nullBoundCount++;
                    break;
                }
            }
            if (nullBounds) continue;

            // check if out of loaded bounds
            if (!inLoadedBounds(aabb)) {
                unloadIdArr.push(id);
            }
        }

        // get unloaded objects that need to be loaded
        let loadIdArr = [];
        for (let id in MapObject.unloadedObjDict) {
            let mo = MapObject.unloadedObjDict[id];
            let aabb = mo.aabb;

            // check for null aabb
            let nullBounds = false;
            for (let j = 0; j < 4; j++) {
                if (aabb[j] == null) {
                    nullBounds = true;
                    nullBoundCount++;
                    break;
                }
            }
            if (nullBounds) continue;

            // check if in loaded bounds
            if (inLoadedBounds(aabb)) {
                loadIdArr.push(id);
            }
        }
        
        // transfer loaded objects that need to be unloaded
        for (let i = 0; i < unloadIdArr.length; i++) {
            let id = unloadIdArr[i];
            let mo = MapObject.objDict[id];
            for (let i = 0; i < mo.colArr.length; i++) {
                mo.colArr[i].unindex();
            }
            MapObject.unloadedObjDict[id] = mo;
            delete MapObject.objDict[id];
        }

        // transfer unloaded objects that need to be loaded
        for (let i = 0; i < loadIdArr.length; i++) {
            let id = loadIdArr[i];
            let mo = MapObject.unloadedObjDict[id];
            for (let i = 0; i < mo.colArr.length; i++) {
                if (!mo.colArr[i].removed) {
                    mo.colArr[i].reindex();
                }
            }
            MapObject.objDict[id] = mo;
            delete MapObject.unloadedObjDict[id];
        }
    }
    */

    static moveCollision(pos, hitCircle, ignoredIds = [], ignoredTags = []) { // movement collision
        // clone hitCircle
        pos = [pos[0], pos[1]]
        let notCollided = true;
        let hc = hitCircle.clone(true);
        hc.pos = pos;

        // get collision canidates
        let canidates = BVH.getColCanidates(hc);

        // do collision detection
        if (hitCircle.id != null)
            ignoredIds.push(hitCircle.id);

        for (let i = 0; i < ignoredIds.length; i++) {
            ignoredIds[i] = ignoredIds[i].toString();
        }
        let colArr = [];
        for (let i = 0; i < canidates.length; i++) {
            let mo = canidates[i];
            for (let j = 0; j < mo.colArr.length; j++) {
                colArr.push(mo.colArr[j]);
            }
        }
        for (let i in Enemy.eDict) {
            let e = Enemy.eDict[i];
            for (let j = 0; j < e.colArr.length; j++) {
                colArr.push(e.colArr[j]);
            }
        }
        for (let i = 0; i < colArr.length; i++) {
            let col = colArr[i];
            let ignored = false;
            for (let k = 0; k < ignoredTags.length; k++) {
                if (col[ignoredTags[k]]) {
                    ignored = true;
                    break;
                }
            }
            if (ignoredIds.includes(col.id.toString())) ignored = true;
            if (ignored) continue;
            let collisionData = Collision.isTouching(hc, col);
            if (col.type === "box") {
                if (collisionData.overlap) {
                    switch (collisionData.type) {
                        case "vertical":
                            pos[1] -= collisionData.vOverlapAmount;
                            notCollided = false;
                            break;
                        case "horizontal":
                            pos[0] -= collisionData.hOverlapAmount;
                            notCollided = false;
                            break;
                        case "middle":
                            if (Math.abs(collisionData.vOverlapAmount) < Math.abs(collisionData.hOverlapAmount)) {
                                pos[1] -= collisionData.vOverlapAmount;
                                notCollided = false;
                            } else {
                                pos[0] -= collisionData.hOverlapAmount;
                                notCollided = false;
                            }
                            break;
                        case "corner":
                            let dir = collisionData.dir;
                            pos = ce.move(pos, dir, -collisionData.overlapAmount);
                            notCollided = false;
                            break;
                    }
                }
            } else if (col.type === "circle") {
                if (collisionData.overlap) {
                    let dir = collisionData.dir;
                    pos = ce.move(pos, dir, -collisionData.overlapAmount);
                    notCollided = false;
                }
            }
        }
        return {
            pos: [pos[0], pos[1]],
            notCollided: notCollided,
            collided: !notCollided
        };
    }

    static collision(col, ignoredIds = [], ignoredTags = []) { // tests if collision collides with any map object
        for (let i = 0; i < ignoredIds.length; i++) {
            ignoredIds[i] = ignoredIds[i].toString();
        }
        let canidates = BVH.getColCanidates(col);
        let colArr = [];
        for (let i = 0; i < canidates.length; i++) {
            let mo = canidates[i];
            for (let j = 0; j < mo.colArr.length; j++) {
                colArr.push(mo.colArr[j]);
            }
        }
        for (let i in Enemy.eDict) {
            let e = Enemy.eDict[i];
            for (let j = 0; j < e.colArr.length; j++) {
                colArr.push(e.colArr[j]);
            }
        }
        for (let i = 0; i < colArr.length; i++) {
            let mCol = colArr[i];
            let ignored = false;
            for (let k = 0; k < ignoredTags.length; k++) {
                if (mCol[ignoredTags[k]]) {
                    ignored = true;
                    break;
                }
            }
            if (ignoredIds.includes(mCol.id.toString())) ignored = true;
            if (ignored) continue;
            if (Collision.isTouching(col, mCol).overlap) return true;
        }
        return false;
    }

    static segCollision(pointA, pointB, ignoredIds = [], ignoredTags = []) { // sees if line seg collides with any map object
        for (let i = 0; i < ignoredIds.length; i++) {
            ignoredIds[i] = ignoredIds[i].toString();
        }
        let canidates = BVH.getSegColCanidates(pointA, pointB);
        let colArr = [];
        for (let i = 0; i < canidates.length; i++) {
            let mo = canidates[i];
            for (let j = 0; j < mo.colArr.length; j++) {
                colArr.push(mo.colArr[j]);
            }
        }
        for (let i in Enemy.eDict) {
            let e = Enemy.eDict[i];
            for (let j = 0; j < e.colArr.length; j++) {
                colArr.push(e.colArr[j]);
            }
        }
        for (let i = 0; i < colArr.length; i++) {
            let mCol = colArr[i];
            let ignored = false;
            for (let k = 0; k < ignoredTags.length; k++) {
                if (mCol[ignoredTags[k]]) {
                    ignored = true;
                    break;
                }
            }
            if (ignoredIds.includes(mCol.id.toString())) ignored = true;
            if (ignored) continue;
            if (mCol.segIntersect(pointA, pointB)) return true;
        }
        return false;
    }

    set hidden(newHidden) {
        if (newHidden != this.#hidden) {
            for (let i in this.colArr) {
                this.colArr[i].enabled = !newHidden;
            }
        }
        this.#hidden = newHidden;
    }
    get hidden() {
        return this.#hidden;
    }
}

class Graphic { // image but can animate and assign to renderlayers and stuff
    static imgDict = {}; // stores all images for all graphics to allow reuse where possible
    static gCount = 0;
    layers = []; // list of renderlayers it is displayed on
    frames = []; // list of images that the graphic cycles through
    fps = 8; // amount of frames per second (if animation)
    offset = [0, 0]; // offset of image (used during render)
    constructor(imagePath, layers, extension = ".png", scale = 1, frameCount = 1, fps = 10, offset = [0, 0, 0], alpha = 1, frameIndex = null, behindFade=true) {
        // first 2 nums of offset are x and y offset
        // 3rd num is the distance from bottom of image to y boundary of the object (center of object's y offset), helps with renderorder
        while (offset.length < 3) {
            offset.push(0);
        }
        Graphic.gCount++;
        this.initData = {
            imagePath: imagePath,
            extension: extension
        }
        this.offset = offset;
        this.layers = layers;
        this.frameCount = frameCount;
        this.fps = fps;
        this.scale = scale;
        this.alpha = alpha;
        this.hidden = false;
        this.behindFade = behindFade
        this.frameIndex = frameIndex;
        if (frameCount <= 1) {
            // use imagePath as path to image (without extension, auto-adds path to graphics folder)
            let src = "../graphics/" + imagePath + extension;
            let img;
            if (src in Graphic.imgDict) {
                img = Graphic.imgDict[src];
            } else {
                img = new Image();
                img.src = src;
                Graphic.imgDict[src] = img;
            }
            this.frames.push(img)
        } else {
            // use imagePath as base path with imagePath + number + extension representing the actual image path (number starts at 0, auto-adds path to graphics folder)
            for (let i = 0; i < frameCount; i++) {
                let src = "../graphics/" + imagePath + ((frameCount > 1) ? "/" : "") + (i).toString() + extension;
                let img;
                if (src in Graphic.imgDict) {
                    img = Graphic.imgDict[src];
                } else {
                    img = new Image();
                    img.src = src;
                    Graphic.imgDict[src] = img;
                }
                this.frames.push(img)
            }
        }
    }

    getImage() { // gets correct frame image
        let frame;
        if (this.frameIndex == null) {
            frame = Math.floor(MainLoop.cycles / MainLoop.fps * this.fps) % this.frames.length;
        } else {
            frame = this.frameIndex;
        }
        return this.frames[frame];
    }

    getDim() { // gets image dimensions
        return [this.frames[0].width, this.frames[0].height]
    }

    clone() { // returns a deepcopy of the object
        return new Graphic(this.initData.imagePath, ce.cloneObj(this.layers), this.initData.extension, this.scale, this.frameCount, this.fps, ce.cloneObj(this.offset), this.alpha, this.frameIndex, this.behindFade);
    }

    // draws graphic
    draw(moPos, alphaMulti=1, ignoredLayers=[]) {
        let alpha = this.alpha * alphaMulti;
        if (this.hidden || alpha <= 0) return;
        for (let l = 0; l < this.layers.length; l++) {
            if (ignoredLayers.includes(this.layers[l])) continue;
            let lCtx = Draw.layerCanvases[this.layers[l]].getContext('2d');
            lCtx.save();
            let img = this.getImage();
            let pos = [moPos[0] + this.offset[0], -moPos[1] - img.height * this.scale - this.offset[1]]
            let imgDim = [img.width, img.height]

            // detect if off screen
            for (let i = 0; i < 2; i++) {
                if (Math.abs(moPos[i] + this.offset[i] + imgDim[i] * this.scale / 2 - Player.camPos[i]) > (ce.screenDim[i]/zoom + imgDim[i] * this.scale) / 2) {
                    lCtx.restore();
                    return;
                }
            }

            // draw image
            if (alpha != 1) lCtx.globalAlpha = alpha;
            lCtx.transformCanvas(this.scale, 0, pos[0], pos[1])
            try {
                lCtx.drawImage(img, 0, 0)
            } catch (e) {
                throw new Error("image broken: " + img.src);
            }
            lCtx.restore();
            if (alpha != 1) lCtx.globalAlpha = 1;
        }
    }
}

class BVH { // bounding volume heirarchy (will replace unload transfer)
    static topNode = null;
    static create() { // creates data tree from scratch
        let moArr = [];
        for (let id in MapObject.objDict) {
            moArr.push(MapObject.objDict[id]);
        }
        this.topNode = new BVH(moArr);
    }

    constructor(children, level=0) { // represents a node
        this.children = children;
        this.aabb = null;
        this.parentNode = false; // if is parent, has other nodes as child nodes, if not parent, children are mapobjects
        this.splitNode(level); // recursive split
        this.updateAabb();
    }

    splitNode(level) { // splits a node's mapobject children into 2 nodes if has more than 2 mapobjects
        if (!this.parentNode && this.children.length > 2) {
            this.parentNode = true;
            // sort by x/y (alternates between levels)
            this.children.sort((a,b) => a.pos[level % 2] - b.pos[level % 2]);
            let mi = Math.ceil(this.children.length-1)/2; // mid index

            // split based on median x and y
            let moSections = [
                [], []
            ];
            for (let i = 0; i < this.children.length; i++) {
                // decide which section to put it in
                moSections[((i >= mi)? 1 : 0)].push(this.children[i]);
            }

            // create child nodes
            let nodeArr = [];
            for (let i = 0; i < moSections.length; i++) {
                nodeArr.push(new BVH(moSections[i], level+1));
            }
            this.children = nodeArr;
        }
    }

    updateAabb() {
        this.aabb = [null, null, null, null];
        let childAabbArr = [];

        // generate list of child aabbs
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (this.parentNode) {
                // child is class BVH
                childAabbArr.push(child.aabb);
            } else {
                // child is class MapObject
                childAabbArr.push(child.aabb);
            }
        }

        // calculate aabb based on child aabbs
        for (let i = 0; i < childAabbArr.length; i++) {
            let aabb = childAabbArr[i];
            for (let j = 0; j < 2; j++) {
                if (this.aabb[j] == null || aabb[j] < this.aabb[j])
                    this.aabb[j] = aabb[j];
                if (this.aabb[j+2] == null || aabb[j+2] > this.aabb[j+2])
                    this.aabb[j+2] = aabb[j+2];
            }
        }
        this.hb = new HitBox([this.aabb[0], this.aabb[1]], [this.aabb[2]-this.aabb[0], this.aabb[3]-this.aabb[1]], false, true);
    }

    static getColCanidates(col) { // narrows down # of MapObjects to check for collisions when using BVH (for collision objects)
        // get aabb of collision object
        if (BVH.topNode == null) return [];
        let aabb;
        if (col.type === "box") {
            aabb = [
                col.pos[0],
                col.pos[1],
                col.pos[0]+col.dim[0],
                col.pos[1]+col.dim[1]
            ];
        } else if (col.type === "circle") {
            aabb = [
                col.pos[0]-col.radius,
                col.pos[1]-col.radius,
                col.pos[0]+col.radius,
                col.pos[1]+col.radius
            ];
        }
        
        // traverse BVH tree
        let canidates = [];
        let recurse = function(node) { // recursive function
            // check if in bounds
            let inBounds = true;
            for (let j = 0; j < 2; j++) {
                if (node.aabb[j+2] < aabb[j]) {
                    inBounds = false;
                    break;
                }
                if (node.aabb[j] > aabb[j+2]) {
                    inBounds = false;
                    break;
                }
            }
            if (!inBounds) return;

            // continue recursion if in bounds
            for (let i = 0; i < node.children.length; i++) {
                if (node.parentNode)
                    recurse(node.children[i]);
                else
                    canidates.push(node.children[i]);
            }
        }

        recurse(BVH.topNode);

        // sort canidates
        canidates.sort((a, b) => a.id - b.id)

        // return canidates
        return canidates;
    }

    static getSegColCanidates(pointA, pointB) { // narrows down # of MapObjects to check for collisions when using BVH (for line segments)
        if (BVH.topNode == null) return [];

        // traverse BVH tree
        let canidates = [];
        let recurse = function(node) { // recursive function
            // check if in bounds
            if (!node.hb.segIntersect(pointA, pointB))
                return;

            // continue recursion if in bounds
            for (let i = 0; i < node.children.length; i++) {
                if (node.parentNode)
                    recurse(node.children[i]);
                else
                    canidates.push(node.children[i]);
            }
        }

        recurse(BVH.topNode);
        return canidates;
    }
}